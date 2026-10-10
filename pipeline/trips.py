"""Turn OSM data into trips: destination x trailhead pairs, walked there and back."""

import math
import re
from dataclasses import dataclass, field

import numpy as np
from scipy.spatial import cKDTree

from .geo import LocalProjection, ascent_descent, din33466_minutes, haversine, rdp_indices, resample, round_up_15, slugify

COLOUR_ORDER = ["red", "blue", "green", "yellow", "black"]
COLOUR_SK = {"red": "červenej", "blue": "modrej", "green": "zelenej", "yellow": "žltej", "black": "čiernej"}
KIND_BONUS = {"hrad": 30, "pleso": 30, "vodopad": 25, "jaskyna": 25, "chata": 20, "vyhliadka": 18, "vrchol": 12, "ine": 5}
GENERIC_NAMES = {"vyhliadka", "výhľad", "rozhľadňa", "altánok", "vyhliadkové miesto", "chata", "hrad", "pleso"}
ROUTE_LIMIT = 18000  # weighted metres one way, generous; time limits are applied afterwards


@dataclass
class Start:
    name: str
    lat: float
    lon: float
    ele: float | None
    osm: str | None
    node: int
    parking: list = field(default_factory=list)  # (walk_m, Feature)
    stops: list = field(default_factory=list)


@dataclass
class Candidate:
    kind: str
    feature: object
    region: dict
    node: int
    score: float


class TripBuilder:
    def __init__(self, cfg, osm, graph, dem, closures, fees, slugs, sitelinks=None, log=print):
        self.cfg = cfg
        self.t = cfg["trips"]
        self.osm = osm
        self.g = graph
        self.dem = dem
        self.closures = closures
        self.fees = fees
        self.slugs = slugs  # key -> slug, updated in place
        self.sitelinks = sitelinks or {}
        self.log = log
        self.proj = LocalProjection()
        self.used_slugs = set()
        self.report = dict(rejected={}, regression=[], regions={})

        def tree(feats):
            if not feats:
                return None
            return cKDTree(self.proj.xy([f.lat for f in feats], [f.lon for f in feats]))

        self.parking_tree = tree(osm.parking)
        self.stop_tree = tree(osm.stops)
        self.poi_feats = [f for _, f in osm.pois]
        self.poi_kinds = [k for k, _ in osm.pois]
        self.poi_tree = tree(self.poi_feats)

    # ----------------------------------------------------------- helpers --
    def in_country(self, lat, lon):
        if self.osm.border is None:
            return True
        from shapely.geometry import Point

        return self.osm.border.contains(Point(lon, lat))

    def region_of(self, lat, lon):
        for r in self.cfg["regions"]:
            if any(w <= lon <= e and s <= lat <= n for w, s, e, n in r["bboxes"]):
                return r
        return None

    def _near(self, tree, feats, lat, lon, radius):
        if tree is None:
            return []
        p = self.proj.xy([lat], [lon])[0]
        idx = tree.query_ball_point(p, radius)
        out = [(float(haversine(lat, lon, feats[i].lat, feats[i].lon)), feats[i]) for i in idx]
        return sorted(out, key=lambda x: x[0])

    def make_start(self, name, lat, lon, ele, osm_ref, node):
        st = Start(name, lat, lon, ele, osm_ref, node)
        st.parking = self._near(self.parking_tree, self.osm.parking, lat, lon, self.t["parking_max_m"])
        stops = self._near(self.stop_tree, self.osm.stops, lat, lon, self.t["train_max_m"])
        st.stops = [
            (d, f) for d, f in stops
            if d <= (self.t["train_max_m"] if f.tags["_mode"] == "vlak" else self.t["bus_stop_max_m"])
        ]
        return st

    # -------------------------------------------------------- trailheads --
    def trailheads(self):
        out = {}
        for f in self.osm.guideposts:
            if not f.name or not self.in_country(f.lat, f.lon):
                continue
            node = self.g.snap(f.lat, f.lon, 60)
            if node is None or node in out:
                continue
            st = self.make_start(f.name, f.lat, f.lon, _num(f.tags.get("ele")), f.osm, node)
            near_stop = any(d <= self.t["trailhead_needs_stop_max_m"] for d, _ in st.stops)
            if st.parking or near_stop:
                out[node] = st
        self.log(f"trailheads with parking or a stop: {len(out)}")
        return out

    # ------------------------------------------------------ destinations --
    def candidates(self):
        out = []
        for kind, f in self.osm.destinations:
            if f.name.strip().lower() in GENERIC_NAMES:
                continue
            region = self.region_of(f.lat, f.lon)
            if region is None or not self.in_country(f.lat, f.lon):
                continue
            node = self.g.snap(f.lat, f.lon, self.t["destination_snap_m"], marked_only=True)
            if node is None:
                continue
            out.append(Candidate(kind, f, region, node, self.score(kind, f)))
        out.sort(key=lambda c: -c.score)
        self.log(f"destination candidates near marked trails: {len(out)}")
        return out

    def score(self, kind, f):
        t = f.tags
        s = KIND_BONUS.get(kind, 0)
        if t.get("wikipedia"):
            s += 15
        if t.get("wikidata"):
            s += 5
            s += min(30, 3 * self.sitelinks.get(t["wikidata"], 0))
        ele = _num(t.get("ele"))
        if kind == "vrchol" and ele:
            s += min(20, ele / 125)
        if "rozhľadň" in f.name.lower() or t.get("tower:type") == "observation":
            s += 10
        return s

    # ------------------------------------------------------------ build --
    def build(self):
        ths = self.trailheads()
        th_nodes = np.array(sorted(ths), dtype=np.int64)
        trips = []
        taken = []  # (region id, lat, lon)

        for p in self.cfg.get("pinned", []):
            trip = self.build_pinned(p)
            if trip:
                trips.append(trip)
                taken.append((trip["region"], trip["destination"]["location"]["lat"], trip["destination"]["location"]["lon"]))

        by_region = {}
        for c in self.candidates():
            by_region.setdefault(c.region["id"], []).append(c)

        for region in self.cfg["regions"]:
            rid = region["id"]
            cands = by_region.get(rid, [])
            chosen = []
            fam_needed = self.t["min_family_per_region"]
            for c in cands:
                n_regular = len([x for x in chosen if not x.get("_extra")])
                n_family = len([x for x in chosen if x["family_friendly"]])
                if n_regular >= region["max_trips"] and n_family >= fam_needed:
                    break
                if any(r == rid and haversine(c.feature.lat, c.feature.lon, la, lo) < self.t["dedupe_m"] for r, la, lo in taken):
                    continue
                trip = self.build_generated(c, ths, th_nodes)
                if not trip:
                    continue
                if n_regular >= region["max_trips"]:
                    if not trip["family_friendly"]:
                        continue
                    trip["_extra"] = True
                chosen.append(trip)
                taken.append((rid, c.feature.lat, c.feature.lon))
            self.report["regions"][rid] = dict(candidates=len(cands), trips=len(chosen))
            self.log(f"{rid}: {len(chosen)} trips from {len(cands)} candidates")
            trips += chosen

        for t in trips:
            t.pop("_extra", None)
        self._rank(trips)
        return trips

    def _reject(self, why):
        self.report["rejected"][why] = self.report["rejected"].get(why, 0) + 1
        return None

    def build_generated(self, c, ths, th_nodes):
        dist, succ = self.g.costs_to(c.node, ROUTE_LIMIT)
        costs = dist[th_nodes]
        ok = np.isfinite(costs)
        if not ok.any():
            return self._reject("no trailhead within reach")
        order = np.argsort(costs)
        best = None
        for i in order:
            if not np.isfinite(costs[i]):
                break
            st = ths[int(th_nodes[i])]
            if haversine(st.lat, st.lon, c.feature.lat, c.feature.lon) < self.t["min_round_trip_m"] / 4:
                continue
            if st.parking:
                best = st
                break
            if best is None:
                best = st
        if best is None:
            return self._reject("trailheads too close")
        out_path = self.g.walk_to_target(succ, best.node, c.node)
        if out_path is None:
            return self._reject("path broken")
        dest = dict(name=c.feature.name, kind=c.kind, lat=c.feature.lat, lon=c.feature.lon,
                    ele=_num(c.feature.tags.get("ele")), osm=c.feature.osm, tags=c.feature.tags)
        trip = self.make_trip(best, dest, out_path, c.region, curated=False)
        if trip is None:
            return None
        if trip["duration_min"] > self.t["max_duration_min"]:
            return self._reject("too long")
        if trip["distance_m"] < self.t["min_round_trip_m"]:
            return self._reject("too short")
        if trip["marked_share"] < self.t["min_marked_share"]:
            return self._reject("mostly unmarked")
        trip["_score"] = c.score
        return trip

    def build_pinned(self, p):
        s, d = p["start"], p["destination"]
        s_node = self.g.snap(s["lat"], s["lon"], 300)
        d_node = self.g.snap(d["lat"], d["lon"], 300)
        if s_node is None or d_node is None:
            self.report["regression"].append(dict(slug=p["slug"], error="start or destination not on the walking graph"))
            return None
        dist, succ = self.g.costs_to(d_node, ROUTE_LIMIT * 2)
        out_path = self.g.walk_to_target(succ, s_node, d_node) if np.isfinite(dist[s_node]) else None
        if out_path is None:
            self.report["regression"].append(dict(slug=p["slug"], error="no path"))
            return None
        st = self.make_start(s["name"], s["lat"], s["lon"], None, None, s_node)
        region = self.region_of(d["lat"], d["lon"]) or self.cfg["regions"][-1]
        dest = dict(name=d["name"], kind=p.get("kind", "ine"), lat=d["lat"], lon=d["lon"], ele=None, osm=None, tags={})
        trip = self.make_trip(st, dest, out_path, region, curated=True, slug=p["slug"], name=p["name"],
                              description=p.get("description"))
        if trip is None:
            self.report["regression"].append(dict(slug=p["slug"], error="could not build"))
            return None
        exp = p.get("expect") or {}
        row = dict(slug=p["slug"])
        for k in ("distance_m", "ascent_m", "duration_min"):
            if exp.get(k):
                row[k] = (trip[k], exp[k], (trip[k] - exp[k]) / exp[k])
        self.report["regression"].append(row)
        trip["_score"] = 60
        return trip

    # ------------------------------------------------------- trip record --
    def make_trip(self, st, dest, out_path, region, curated, slug=None, name=None, description=None):
        g = self.g
        back_path = None
        if g.has_oneway(out_path):
            dist, pred = g.costs_from(out_path[-1], ROUTE_LIMIT * 2)
            back_path = g.walk_from_source(pred, out_path[-1], out_path[0]) if np.isfinite(dist[out_path[0]]) else None
            if back_path is None:
                return self._reject("one-way path without a way back")
        full = out_path + (back_path[1:] if back_path else [])
        turn = len(out_path) - 1

        lat, lon = g.lat[full], g.lon[full]
        e_idx = g.edges(full) if len(full) > 1 else np.zeros(0, int)
        e_len = g.edge_len[e_idx]
        e_way = [g.ways[w] for w in g.edge_way[e_idx]]
        e_colour = [self._colour(w) for w in e_way]
        total = float(e_len.sum())
        marked_len = float(sum(L for L, w in zip(e_len, e_way) if w.routes))
        out_len = float(e_len[:turn].sum())
        walk_len = total if back_path else 2 * out_len
        if walk_len <= 0:
            return self._reject("empty path")

        # elevation
        rl, ro, rt = resample(lat, lon, 20.0)
        ele = self.dem.sample(rl, ro) if self.dem else np.full(len(rl), np.nan)
        have_dem = np.isfinite(ele).mean() > 0.9
        if have_dem:
            ele = _smooth(_fill(ele), 5)
            turn_t = float(np.cumsum(np.concatenate([[0], e_len]))[turn])
            k = int(np.searchsorted(rt, turn_t))
            up1, down1 = ascent_descent(ele[: k + 1].tolist(), 5.0)
            if back_path:
                up2, down2 = ascent_descent(ele[k:].tolist(), 5.0)
            else:
                up2, down2 = down1, up1
            max_ele = float(np.nanmax(ele))
        else:
            e0 = st.ele
            e1 = dest["ele"]
            climb = max(0.0, (e1 or 0) - (e0 or e1 or 0))
            up1, down1, up2, down2 = climb, 0.0, 0.0, climb
            max_ele = e1
        up, down = up1 + up2, down1 + down2
        duration = round_up_15(din33466_minutes(walk_len, up, down))
        max_sac = max((w.sac for w in e_way), default=0)
        difficulty = (
            "tazka" if duration >= 360 or up >= 1000 or max_sac >= 4
            else "lahka" if duration <= 180 and up <= 400 and max_sac <= 2
            else "stredna"
        )
        family = difficulty == "lahka" and duration <= 150 and max_sac <= 2

        # marking colours by length
        col_len = {}
        for L, c in zip(e_len, e_colour):
            if c:
                col_len[c] = col_len.get(c, 0) + L
        marking = sorted(col_len, key=lambda c: -col_len[c])

        # rules
        refs = {g.routes[i]["ref"] for w in e_way for i in w.routes if g.routes[i]["ref"]}
        tags = set().union(*(w.tags for w in e_way)) if e_way else set()
        closure_ids = self.closures.match(rl, ro, refs, tags)
        fee_rule_ids = self.fees.match(rl, ro, refs, tags)
        fees = self._fees(dest, fee_rule_ids)

        # path for the JSON: simplified, with elevation and colour runs
        xy = self.proj.xy(lat, lon)
        keep = rdp_indices(xy, 5.0)
        path_pts = keep if back_path else [i for i in keep if i <= turn]
        if turn not in path_pts:
            path_pts = sorted(set(path_pts) | {turn})
        pe = self.dem.sample(lat[path_pts], lon[path_pts]) if (self.dem and have_dem) else np.full(len(path_pts), np.nan)
        path = [[round(float(lon[i]), 6), round(float(lat[i]), 6), None if not np.isfinite(e) else int(round(e))]
                for i, e in zip(path_pts, pe)]
        runs = []
        for j in range(len(path_pts) - 1):
            c = e_colour[path_pts[j]]
            if runs and runs[-1]["colour"] == c:
                runs[-1]["to"] = j + 1
            else:
                runs.append(dict(**{"from": j, "to": j + 1}, colour=c))

        # POIs along the walk
        pois = []
        if self.poi_tree is not None:
            pxy = self.proj.xy(rl, ro)
            hits = set()
            for lst in self.poi_tree.query_ball_point(pxy, self.t["poi_max_m"]):
                hits.update(lst)
            for i in sorted(hits):
                f = self.poi_feats[i]
                if f.osm == dest["osm"]:
                    continue
                pois.append(dict(kind=self.poi_kinds[i], name=f.name, location=_loc(f.lat, f.lon), osm=f.osm))
            pois = pois[:20]

        parking = [_parking(d, f) for d, f in st.parking[:4]]
        stops = [_stop(d, f) for d, f in st.stops]
        stops = stops[:3] + [s for s in stops[3:] if s["mode"] == "vlak"][:1]

        key = f"{dest['osm'] or dest['name']}|{st.osm or st.name}"
        slug = slug or self._slug(key, dest["name"], st.name)
        name = name or dest["name"]
        lats_all, lons_all = np.asarray(lat), np.asarray(lon)
        trip = dict(
            slug=slug,
            name=name,
            description=description or self._describe(dest, st, marking, bool(back_path)),
            region=region["id"],
            region_name=region["name"],
            protected_area=region.get("protected_area"),
            destination=dict(name=dest["name"], kind=dest["kind"], location=_loc(dest["lat"], dest["lon"]),
                             ele_m=_int(dest["ele"] or (float(ele[k]) if have_dem else None)), osm=dest["osm"]),
            start=dict(name=st.name, location=_loc(st.lat, st.lon),
                       ele_m=_int(st.ele or (float(ele[0]) if have_dem else None)), osm=st.osm),
            parking=parking[0] if parking else None,
            transit=stops[0] if stops else None,
            route="okruh" if back_path else "tam-a-spat",
            distance_m=int(round(walk_len)),
            ascent_m=int(round(up)),
            duration_min=duration,
            max_ele_m=_int(max_ele),
            difficulty=difficulty,
            family_friendly=family,
            marking=marking,
            marked_share=round(marked_len / total, 2) if total else 0.0,
            fees=fees,
            closure_rule_ids=closure_ids,
            rank=0,
            bbox=[round(float(lons_all.min()), 5), round(float(lats_all.min()), 5),
                  round(float(lons_all.max()), 5), round(float(lats_all.max()), 5)],
            curated=curated,
            gpx_url=f"/gpx/{slug}.gpx",
            path=path,
            turnaround_index=path_pts.index(turn),
            marking_runs=runs,
            parking_alternatives=parking[1:],
            transit_alternatives=stops[1:],
            pois=pois,
            _gpx=(lat, lon, ele if have_dem else None, rt, turn, bool(back_path)),
        )
        return trip

    def _colour(self, way):
        cols = [self.g.routes[i]["colour"] for i in way.routes if self.g.routes[i]["colour"]]
        if not cols:
            return None
        return min(cols, key=lambda c: COLOUR_ORDER.index(c))

    def _fees(self, dest, rule_ids):
        fees = []
        t = dest["tags"]
        if t.get("fee") == "yes" or t.get("charge"):
            charge = t.get("charge")
            amount = _num(re.sub(r"[^\d.,]", " ", charge or "").replace(",", ".").split()[0]) if charge and re.search(r"\d", charge) else None
            fees.append(dict(kind="vstupne", text=f"Vstupné{': ' + charge if charge else ''}", amount_eur=amount,
                             source="osm", source_url=f"https://www.openstreetmap.org/{dest['osm']}" if dest["osm"] else None,
                             rule_id=None))
        for rid in rule_ids:
            r = next(x["rule"] for x in self.fees.rules if x["id"] == rid)
            fees.append(dict(kind="vstupne", text=r["text"], amount_eur=r.get("amount_eur"), source="rule",
                             source_url=r["source_url"], rule_id=rid))
        return fees

    def _slug(self, key, dest_name, start_name):
        if key in self.slugs and self.slugs[key] not in self.used_slugs:
            s = self.slugs[key]
        else:
            base = slugify(dest_name)
            s = base
            taken = set(self.slugs.values()) | self.used_slugs
            if s in taken:
                s = f"{base}-{slugify(start_name, 24)}"
            n = 2
            while s in taken:
                s = f"{base}-{n}"
                n += 1
            self.slugs[key] = s
        self.used_slugs.add(s)
        return s

    @staticmethod
    def _describe(dest, st, marking, loop):
        n = dest["name"]
        ele = dest["ele"]
        first = {
            "vrchol": f"Výstup na vrchol {n}" + (f" ({int(ele)} m)" if ele else "") + ".",
            "vyhliadka": f"Výlet k vyhliadke {n}.",
            "hrad": f"Výlet k hradu: {n}.",
            "chata": f"Výlet k horskej chate: {n}.",
            "pleso": f"Výlet k plesu: {n}.",
            "vodopad": f"Výlet k vodopádu: {n}.",
            "jaskyna": f"Výlet k jaskyni: {n}.",
        }.get(dest["kind"], f"Výlet: {n}.")
        second = f"Štart: {st.name}, " + ("okruh." if loop else "späť rovnakou cestou.")
        third = ""
        if marking:
            cols = [COLOUR_SK[c] for c in marking[:3]]
            third = " Po " + (" a ".join([", ".join(cols[:-1]), cols[-1]]) if len(cols) > 1 else cols[0]) + (" značke." if len(cols) == 1 else " značke.")
        return f"{first} {second}{third}"

    @staticmethod
    def _rank(trips):
        if not trips:
            return
        hi = max(t["_score"] for t in trips) or 1
        for t in trips:
            t["rank"] = int(round(100 * t.pop("_score") / hi))


# ---------------------------------------------------------------- utils --
def _num(v):
    if v is None:
        return None
    try:
        return float(str(v).replace(",", ".").split()[0].rstrip("m"))
    except (ValueError, IndexError):
        return None


def _int(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else int(round(v))


def _loc(lat, lon):
    return dict(lat=round(float(lat), 6), lon=round(float(lon), 6))


def _parking(d, f):
    fee = f.tags.get("fee")
    return dict(name=f.name, location=_loc(f.lat, f.lon), walk_m=int(round(d)),
                fee=True if fee == "yes" else False if fee == "no" else None, osm=f.osm)


def _stop(d, f):
    return dict(name=f.name, mode=f.tags["_mode"], location=_loc(f.lat, f.lon), walk_m=int(round(d)), osm=f.osm)


def _fill(a):
    a = np.asarray(a, float)
    ok = np.isfinite(a)
    if ok.all() or not ok.any():
        return a
    idx = np.arange(len(a))
    a[~ok] = np.interp(idx[~ok], idx[ok], a[ok])
    return a


def _smooth(a, w):
    if len(a) < w:
        return a
    k = np.ones(w) / w
    pad = w // 2
    return np.convolve(np.pad(a, pad, mode="edge"), k, mode="valid")
