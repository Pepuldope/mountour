"""Apply data/closure-rules.json and data/fee-rules.json selectors to trips."""

import numpy as np

from .geo import LocalProjection

PROBE_RADIUS_M = 150


class RuleMatcher:
    def __init__(self, rules, probes):
        """rules: list of rule dicts with an optional 'selector'; probes: name -> [(lat, lon)] from OSM."""
        self.proj = LocalProjection()
        self.rules = []
        self.unresolved = {}
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
            if missing:
                self.unresolved[r["id"]] = missing
            self.rules.append(dict(
                id=r["id"],
                bbox=(w, s, e, n),
                probes=self.proj.xy([p[0] for p in pts], [p[1] for p in pts]) if pts else np.zeros((0, 2)),
                route_refs=set(sel.get("route_refs", [])),
                way_tags=set(sel.get("way_tags", [])),
                rule=r,
            ))

    def match(self, lats, lons, route_refs, way_tags):
        """Ids of rules covering a walk given its resampled points, route refs and way tags used."""
        xy = self.proj.xy(lats, lons)
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
            hit = hit or bool(r["route_refs"] & route_refs) or bool(r["way_tags"] & way_tags)
            if hit:
                out.append(r["id"])
        return out
