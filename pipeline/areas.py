"""Mountain area outlines for the home map: the named areas split all of Slovakia between them.

    python -m pipeline.areas [--root .]

Reads public/data/trips/*.json and writes public/data/map/areas.json. Every
spot in Slovakia belongs to the area whose trails are nearest: trails are
sampled every 300 m onto a 1 km grid, each cell goes to the area with most
samples in it, and the cells' Voronoi regions are merged per area and clipped
to the country (pipeline/slovakia.geojson, a coarse outline). Trips of the
catch-all area ("dalsie") seed nothing, so their spots go to a neighbour.
"""

import argparse
import json
import math
from pathlib import Path

import shapely
from shapely.geometry import LineString, MultiPoint, Point, Polygon, mapping, shape
from shapely.ops import unary_union

OTHER = "dalsie"
GRID_M = 1000.0
SAMPLE_M = 300
# A thin gap between neighbours so each outline reads on its own.
GAP_M = 200
MIN_PART_M2 = 30e6
SIMPLIFY_M = 350
LAT0 = 48.7
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110540


def _fwd(c):
    return c * [KX, KY]


def _back(c):
    return c / [KX, KY]


def _round(c):
    return [_round(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], 4), round(c[1], 4)]


def build(trips, country):
    """trips: [{region, region_name, path}], country: a GeoJSON geometry. Returns a FeatureCollection."""
    cell_votes, lines_by, names = {}, {}, {}
    for t in trips:
        if t["region"] == OTHER or len(t["path"]) < 2:
            continue
        names[t["region"]] = t["region_name"]
        line = shapely.transform(LineString([(p[0], p[1]) for p in t["path"]]), _fwd)
        lines_by.setdefault(t["region"], []).append(line)
        for d in range(0, int(line.length) + 1, SAMPLE_M):
            p = line.interpolate(d)
            votes = cell_votes.setdefault((int(p.x // GRID_M), int(p.y // GRID_M)), {})
            votes[t["region"]] = votes.get(t["region"], 0) + 1
    if not cell_votes:
        return dict(type="FeatureCollection", features=[])
    pts = [((ix + 0.5) * GRID_M, (iy + 0.5) * GRID_M) for ix, iy in cell_votes]
    owner = [max(v, key=v.get) for v in cell_votes.values()]
    sk = shapely.transform(shape(country), _fwd)
    cells = shapely.voronoi_polygons(MultiPoint(pts), extend_to=sk.envelope)
    tree = shapely.STRtree([Point(p) for p in pts])
    by_area = {}
    for poly in cells.geoms:
        i = tree.query(poly, predicate="contains")
        if len(i):
            by_area.setdefault(owner[int(i[0])], []).append(poly)

    feats = []
    for rid, polys in by_area.items():
        g = unary_union(polys).intersection(sk).buffer(-GAP_M).buffer(0)
        parts = [Polygon(p.exterior) for p in getattr(g, "geoms", [g]) if p.area > MIN_PART_M2]
        if not parts:
            continue
        outline = shapely.transform(unary_union(parts).simplify(SIMPLIFY_M), _back)
        trails = unary_union(lines_by[rid])
        # The dot sits in the middle of the area's own trails when that is inside the outline.
        mid = shapely.transform(trails.centroid, _back)
        label = mid if outline.contains(mid) else outline.representative_point()
        gj = mapping(outline)
        feats.append(dict(
            type="Feature",
            properties=dict(
                id=rid,
                name=names[rid],
                short=names[rid].split(",")[0].split(" a ")[0].strip(),
                n=len(lines_by[rid]),
                label=[round(label.x, 4), round(label.y, 4)],
                bbox=[round(v, 4) for v in shapely.transform(trails, _back).bounds],
            ),
            geometry=dict(type=gj["type"], coordinates=_round(gj["coordinates"])),
        ))
    # Biggest first: when names would overlap, the bigger area keeps its name.
    feats.sort(key=lambda f: -f["properties"]["n"])
    return dict(type="FeatureCollection", features=feats)


def write(root):
    root = Path(root)
    tdir = root / "public" / "data" / "trips"
    index = json.loads((tdir / "index.json").read_text())
    trips = [json.loads((tdir / f"{t['slug']}.json").read_text()) for t in index["trips"] if not t.get("variant_of")]
    country = json.loads((Path(__file__).parent / "slovakia.geojson").read_text())["geometry"]
    fc = build(trips, country)
    out = root / "public" / "data" / "map" / "areas.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")) + "\n")
    return len(fc["features"])


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    a = ap.parse_args(argv)
    print(f"{write(a.root)} areas")


if __name__ == "__main__":
    main()
