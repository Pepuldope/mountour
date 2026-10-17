"""Apply data/closure-rules.json and data/fee-rules.json selectors to trips."""

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree

from .geo import LocalProjection, resample
from .osm import plain

PROBE_RADIUS_M = 150
END_SNAP_M = 500  # a section's end (a hut, a junction, a saddle) may sit this far from its trail
ON_SECTION_M = 30  # a trip point this close to a closed section walks on it
ON_SECTION_MIN_M = 400  # ...for at least this long (or half the section, if shorter): a trip may share
# a few hundred metres with a closed stretch where it starts (Kmeťov vodopád from Tri Studničky)
STEP_M = 20.0
GOAL_ON_M = 50  # a goal this close to a closed stretch...
GOAL_END_M = 200  # ...and this far from both its ends is on it
GAP_PAD = 0.03  # degrees around a stretch's ends searched to bridge a gap in its route
GAP_COST = 5


def section_keys(rules):
    """plain() names of every section end, for osm.load(name_keys=...)."""
    return {plain(n) for r in rules for s in (r.get("selector") or {}).get("sections", [])
            for k in ("from", "to") for n in _names(s.get(k))}


def _names(v):
    return [] if v is None else [v] if isinstance(v, str) else list(v)


class RuleMatcher:
    def __init__(self, rules, probes, graph=None, named=(), hints=()):
        """rules: list of rule dicts with an optional 'selector'; probes: name -> [(lat, lon)] from OSM;
        graph and named (osm.named) resolve 'sections': stretches of a marked route between two named places.
        hints (Features, e.g. guideposts) are named in the message when a section's end isn't found."""
        self.proj = LocalProjection()
        self.hints = [(f.name, f.lat, f.lon) for f in hints if f.name]
        self.rules = []
        self.unresolved = {}  # rule id -> what could not be found
        self.sections = {}  # rule id -> [(label, length m)], for the report
        for r in rules:
            sel = r.get("selector") or {}
            w, s, e, n = sel.get("bbox", [-180, -90, 180, 90])
            pts = []
            missing = []
            for name in sel.get("probes", []):
                found = [(la, lo) for la, lo in probes.get(name, []) if w <= lo <= e and s <= la <= n]
                pts += found
                if not found:
                    missing.append(name)
            secs = []
            for sec in sel.get("sections", []):
                got = self._section(graph, named, sec, (w, s, e, n))
                if isinstance(got, str):
                    missing.append(got)
                else:
                    secs.append(got)
                    self.sections.setdefault(r["id"], []).append((_label(sec), got["length"]))
            if missing:
                self.unresolved[r["id"]] = missing
            self.rules.append(dict(
                id=r["id"],
                bbox=(w, s, e, n),
                probes=self.proj.xy([p[0] for p in pts], [p[1] for p in pts]) if pts else np.zeros((0, 2)),
                sections=secs,
                route_refs=set(sel.get("route_refs", [])),
                way_tags=set(sel.get("way_tags", [])),
                rule=r,
            ))

    def match(self, lats, lons, route_refs, way_tags, goal=None):
        """Ids of rules covering a walk given its resampled points, route refs and way tags used, and
        its goal (lat, lon): a goal on a closed stretch, away from its ends, closes the trip however
        little of the stretch it walks (Plačlivé on the main ridge, reached from the side)."""
        xy = self.proj.xy(lats, lons)
        gxy = self.proj.xy([goal[0]], [goal[1]])[0] if goal else None
        lo, hi = xy.min(axis=0) - ON_SECTION_M, xy.max(axis=0) + ON_SECTION_M
        out = []
        for r in self.rules:
            w, s, e, n = r["bbox"]
            inside = (lons >= w) & (lons <= e) & (lats >= s) & (lats <= n)
            if not inside.any():
                continue
            hit = False
            if len(r["probes"]):
                d = np.hypot(xy[:, None, 0] - r["probes"][None, :, 0], xy[:, None, 1] - r["probes"][None, :, 1])
                hit = bool((d.min(axis=0) <= PROBE_RADIUS_M).any())
            for sec in r["sections"]:
                if hit:
                    break
                if (sec["lo"] > hi).any() or (sec["hi"] < lo).any():
                    continue
                d, _ = sec["tree"].query(xy, distance_upper_bound=ON_SECTION_M)
                hit = np.isfinite(d).sum() * STEP_M >= min(ON_SECTION_MIN_M, sec["length"] / 2)
                if not hit and gxy is not None and min(np.hypot(*(gxy - e)) for e in sec["ends"]) > GOAL_END_M:
                    hit = sec["tree"].query(gxy)[0] <= GOAL_ON_M
            hit = hit or bool(r["route_refs"] & route_refs) or bool(r["way_tags"] & way_tags)
            if hit:
                out.append(r["id"])
        return out

    def _section(self, graph, named, sec, bbox):
        """The stretch of route `ref` from `from` to `to` as points, or a text saying what is missing."""
        label = _label(sec)
        if graph is None:
            return f"{label}: no trail graph"
        w, s, e, n = bbox
        refs = set(_names(sec["ref"]))
        want = {i for i, r in enumerate(graph.routes) if r.get("ref") in refs}
        on_route = np.array([bool(want.intersection(way.routes)) for way in graph.ways], bool)
        src, dst = graph.edge_key // graph.n, graph.edge_key % graph.n
        keep = on_route[graph.edge_way] if len(on_route) else np.zeros(0, bool)
        keep &= (graph.lon[src] >= w) & (graph.lon[src] <= e) & (graph.lat[src] >= s) & (graph.lat[src] <= n)
        if not keep.any():
            return f"{label}: no ways of route {'/'.join(refs)} in the box"
        a, b, length = src[keep], dst[keep], graph.edge_len[keep]
        nodes = np.unique(np.concatenate([a, b]))
        tree = cKDTree(self.proj.xy(graph.lat[nodes], graph.lon[nodes]))
        ends, places = [], []
        for k in ("from", "to"):
            node, place = self._end(named, sec.get(k), tree, nodes, bbox)
            if node is None:
                near = sorted({h for h, la, lo in self.hints if tree.query(self.proj.xy([la], [lo])[0])[0] < 100})
                return (f"{label}: '{' / '.join(_names(sec.get(k)))}' not found within {END_SNAP_M} m of route {'/'.join(refs)}"
                        + (f" (guideposts on it: {', '.join(near)})" if near else ""))
            ends.append(node)
            places.append(place)
        g = csr_matrix((length, (a, b)), shape=(graph.n, graph.n))
        dist, pred = dijkstra(g, directed=False, indices=ends[0], return_predecessors=True)
        if not np.isfinite(dist[ends[1]]):
            # Two strands of the route near the far end (a loop like Mlynická and Furkotská doliny,
            # both up to Bystrá lávka): take the nearest point of the strand this stretch is on.
            for i in sorted(tree.query_ball_point(places[1], END_SNAP_M),
                            key=lambda i: np.hypot(*(tree.data[i] - places[1]))):
                if np.isfinite(dist[nodes[i]]):
                    ends[1] = int(nodes[i])
                    break
        if not np.isfinite(dist[ends[1]]):
            # A gap in the mapped route (a way left out of the relation): bridge it over other paths
            # nearby, made dear so the stretch keeps to the route wherever the route exists.
            la, lo = graph.lat[ends], graph.lon[ends]
            near = ((graph.lat[src] >= la.min() - GAP_PAD) & (graph.lat[src] <= la.max() + GAP_PAD)
                    & (graph.lon[src] >= lo.min() - GAP_PAD) & (graph.lon[src] <= lo.max() + GAP_PAD) & ~keep)
            g = csr_matrix((np.concatenate([length, graph.edge_len[near] * GAP_COST]),
                            (np.concatenate([a, src[near]]), np.concatenate([b, dst[near]]))), shape=(graph.n, graph.n))
            dist, pred = dijkstra(g, directed=False, indices=ends[0], return_predecessors=True)
        if not np.isfinite(dist[ends[1]]):
            return f"{label}: route {'/'.join(refs)} doesn't connect its two ends"
        if dist[ends[1]] < 50:
            return f"{label}: both ends snap to the same spot on route {'/'.join(refs)}"
        path = [ends[1]]
        while path[-1] != ends[0]:
            path.append(int(pred[path[-1]]))
        rl, ro, t = resample(graph.lat[path], graph.lon[path], STEP_M)
        xy = self.proj.xy(rl, ro)
        return dict(tree=cKDTree(xy), lo=xy.min(axis=0), hi=xy.max(axis=0), length=float(t[-1]), label=label, ends=(xy[0], xy[-1]))

    def _end(self, named, names, tree, nodes, bbox):
        """(route node nearest the named place, the place's x/y), for the closest such place to the route,
        or (None, None)."""
        w, s, e, n = bbox
        best = None
        for key in map(plain, _names(names)):
            for name, p, lat, lon in named:
                if key not in p or not (w <= lon <= e and s <= lat <= n):
                    continue
                xy = self.proj.xy([lat], [lon])[0]
                d, i = tree.query(xy)
                rank = (d > END_SNAP_M, p != key, d)  # near the route first, then the exact name, then distance
                if best is None or rank < best[0]:
                    best = (rank, int(nodes[i]), xy)
            if best and not best[0][0]:
                return best[1], best[2]
        return None, None


def _label(sec):
    return f"{'/'.join(_names(sec['ref']))} {' / '.join(_names(sec.get('from')))} – {' / '.join(_names(sec.get('to')))}"
