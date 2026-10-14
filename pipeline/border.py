"""Slovakia's border for the maps, which darken everything outside it.

Written by pipeline.run from the OSM admin boundary in the extract, to
public/data/map/border.json: one GeoJSON Polygon (the mainland's outline,
simplified to about 25 m). The first copy came from Natural Earth (1:10m) and
is replaced on the next weekly run.
"""

import json
from pathlib import Path

TOLERANCE_DEG = 0.0003  # about 25 m


def feature(border):
    """GeoJSON Feature for the largest part of a shapely (Multi)Polygon, outer edge only."""
    from shapely.geometry import Polygon

    parts = getattr(border, "geoms", [border])
    main = max(parts, key=lambda p: p.area)
    ring = Polygon(main.exterior).simplify(TOLERANCE_DEG, preserve_topology=True).exterior
    coords = [[round(x, 5), round(y, 5)] for x, y in ring.coords]
    return {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [coords]}}


def write(root, border):
    f = feature(border)
    out = Path(root) / "public" / "data" / "map" / "border.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(f, separators=(",", ":")) + "\n")
    return len(f["geometry"]["coordinates"][0])
