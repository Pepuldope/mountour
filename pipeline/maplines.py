"""The trips as map lines for the home map, split by area so the browser loads only what is on screen.

    python -m pipeline.maplines [--root .]

Reads public/data/trips/*.json and writes, under public/data/map/:
    meta.json        grid, cells and the cut-offs for the five popularity steps
    overview.json    every trip, simplified (~50 m), for the zoomed-out views
    c/<ix>_<iy>.json the trips whose line crosses that grid cell, in detail (~8 m)

The lines are the trips' own paths (the way out; a loop in full), so the coloured
line on the map is exactly the line a click selects. The grid is the trail
network's (public/data/trails/meta.json) so both load the same cells.
"""

import argparse
import datetime as dt
import json
from pathlib import Path

import numpy as np

from .geo import LocalProjection, rdp_indices

VERSION = 1
GRID = dict(lon0=16.75, lat0=47.7, dx=0.5, dy=0.25)
DETAIL_TOL_M = 8
OVERVIEW_TOL_M = 50
STEPS = 5


def simplify(coords, tol_m, digits):
    """[[lon, lat], ...] kept to within tol_m of the original."""
    c = np.asarray(coords, float)
    if len(c) > 2:
        keep = rdp_indices(LocalProjection().xy(c[:, 1], c[:, 0]), tol_m)
    else:
        keep = range(len(c))
    return [[round(float(c[k, 0]), digits), round(float(c[k, 1]), digits)] for k in keep]


def trip_line(trip):
    """The way out (there-and-back trips come back the same way) or the whole loop."""
    path = trip["path"]
    if trip.get("route") != "okruh" and trip.get("turnaround_index") is not None:
        path = path[: trip["turnaround_index"] + 1]
    return [[p[0], p[1]] for p in path]


def cuts(ranks):
    """Rank cut-offs that split the trips into STEPS equal groups."""
    r = np.sort(np.asarray(ranks, float))
    return [float(r[int(len(r) * k / STEPS)]) for k in range(1, STEPS)] if len(r) else [0.0] * (STEPS - 1)


def step(rank, cut):
    return int(sum(rank >= c for c in cut))


def cells_of(coords):
    """Grid cells ("ix_iy") a line passes through (by its vertices; lines are dense enough)."""
    out = set()
    for lon, lat in coords:
        out.add(f"{int((lon - GRID['lon0']) // GRID['dx'])}_{int((lat - GRID['lat0']) // GRID['dy'])}")
    return out


def write(root, now=None):
    root = Path(root)
    now = now or dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    tdir = root / "public" / "data" / "trips"
    out = root / "public" / "data" / "map"
    (out / "c").mkdir(parents=True, exist_ok=True)
    index = json.loads((tdir / "index.json").read_text())
    # One line per place: other routes to it show only on its trip page.
    trips = [json.loads((tdir / f"{t['slug']}.json").read_text()) for t in index["trips"] if not t.get("variant_of")]
    cut = cuts([t["rank"] for t in trips])

    overview, cells = [], {}
    for t in trips:
        line = trip_line(t)
        if len(line) < 2:
            continue
        props = dict(s=t["slug"], r=t["rank"], p=step(t["rank"], cut))
        overview.append(_feature(props, simplify(line, OVERVIEW_TOL_M, 4)))
        detail = simplify(line, DETAIL_TOL_M, 5)
        for key in cells_of(detail):
            cells.setdefault(key, []).append(_feature(props, detail))

    for f in (out / "c").glob("*.json"):
        if f.stem not in cells:
            f.unlink()
    for key, features in cells.items():
        _dump(out / "c" / f"{key}.json", dict(type="FeatureCollection", features=features))
    _dump(out / "overview.json", dict(type="FeatureCollection", features=overview))
    _dump(out / "meta.json", dict(version=VERSION, generated_at=now, grid=GRID, cells=sorted(cells), cuts=cut,
                                  trips=len(overview)))
    return len(overview), len(cells)


def _feature(props, coords):
    return dict(type="Feature", properties=props, geometry=dict(type="LineString", coordinates=coords))


def _dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    a = ap.parse_args(argv)
    n, c = write(a.root)
    print(f"{n} trip lines in {c} cells")


if __name__ == "__main__":
    main()
