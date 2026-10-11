"""Every named bus stop and train station in Slovakia, so the trip page can say
where to catch the bus from your start point (the browser picks the nearest
one itself; your location never leaves it).

    python -m pipeline.stops --pbf slovakia-latest.osm.pbf [--root .]

Writes, under public/data/stops/:
    <ix>_<iy>.json  stops in one grid cell (same grid as the trail map):
                    [[name, mode, lat, lon], ...], mode "a" bus, "v" train, "e" tram
    meta.json       grid, cells, counts
"""

import argparse
import datetime as dt
import json
import math
import sys
from pathlib import Path

import osmium

from . import osm as osm_mod
from .network import GRID, cell_of, log

VERSION = 1
MODE_CODE = {"autobus": "a", "vlak": "v", "elektricka": "e"}
# Both platforms of one stop (one per direction) share a name: keep one per name within this.
SAME_STOP_M = 250


def _m(a, b):
    """Metres between two (lat, lon), flat approximation (fine under a few km)."""
    kx = 111320.0 * math.cos(math.radians((a[0] + b[0]) / 2))
    return math.hypot((a[1] - b[1]) * kx, (a[0] - b[0]) * 110540.0)


def read(path):
    stops = []
    fp = osmium.FileProcessor(path, osmium.osm.NODE).with_filter(osmium.filter.EmptyTagFilter())
    for n in fp:
        t = dict(n.tags)
        mode = osm_mod.stop_mode(t)
        name = (t.get("name") or "").strip()
        if not mode or not name:
            continue
        stops.append(dict(name=name, mode=mode, lat=n.location.lat, lon=n.location.lon))
    return stops


def dedupe(stops):
    """One entry per stop: platforms of the same name and mode close together collapse to their middle."""
    groups = {}
    for s in stops:
        groups.setdefault((s["name"], s["mode"]), []).append(s)
    out = []
    for (name, mode), members in groups.items():
        clusters = []
        for s in members:
            p = (s["lat"], s["lon"])
            for c in clusters:
                if _m(c["first"], p) <= SAME_STOP_M:
                    c["pts"].append(p)
                    break
            else:
                clusters.append(dict(first=p, pts=[p]))
        for c in clusters:
            lat = sum(p[0] for p in c["pts"]) / len(c["pts"])
            lon = sum(p[1] for p in c["pts"]) / len(c["pts"])
            out.append(dict(name=name, mode=mode, lat=lat, lon=lon))
    return sorted(out, key=lambda s: (s["lat"], s["lon"], s["name"]))


def write(root, stops, osm_ts=None):
    out = Path(root) / "public" / "data" / "stops"
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.json"):
        f.unlink()
    cells = {}
    for s in stops:
        cells.setdefault(cell_of(s["lat"], s["lon"]), []).append(
            [s["name"], MODE_CODE[s["mode"]], round(s["lat"], 5), round(s["lon"], 5)]
        )
    for key, rows in cells.items():
        # One stop per line, so the weekly re-run diffs line by line.
        body = ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows)
        (out / f"{key}.json").write_text("[\n" + body + "\n]\n")
    counts = {m: sum(1 for s in stops if s["mode"] == m) for m in MODE_CODE}
    meta = dict(
        version=VERSION,
        generated_at=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        osm_data_at=osm_ts,
        attribution="© OpenStreetMap contributors (ODbL)",
        grid=GRID,
        cells=sorted(cells),
        counts=counts,
    )
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--pbf", required=True)
    ap.add_argument("--root", default=".")
    ap.add_argument("--osm-timestamp", default=None)
    a = ap.parse_args(argv)
    log("reading stops")
    stops = dedupe(read(a.pbf))
    if not stops:
        log("no stops found")
        return 1
    meta = write(a.root, stops, a.osm_timestamp)
    log(f"{len(stops)} stops in {len(meta['cells'])} cells: {meta['counts']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
