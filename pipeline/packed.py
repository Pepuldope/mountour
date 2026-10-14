"""Compact line files for the maps (public/data/trails, public/data/map).

GeoJSON repeats `{"type":"Feature","properties":...,"geometry":...}` and full
coordinates for every line. The maps' line files instead store each property as
one list and each line as whole-number steps from the previous point (degrees x
`scale`), so the home page downloads about half as much for the same lines. The
browser turns them back into GeoJSON (lib/packedLines.ts).

    {"format":"lines-v1","scale":10000,"props":{"p":[0,3,...]},
     "lines":[[x0,y0,dx1,dy1,...],...]}

`python -m pipeline.packed FILE...` converts GeoJSON line files in place.
"""

import json
import sys
from pathlib import Path

FORMAT = "lines-v1"


def pack(features, digits):
    """Line features (all with the same property keys) -> packed dict; `digits` = decimals kept."""
    scale = 10**digits
    keys = sorted({k for f in features for k in f["properties"]})
    props = {k: [f["properties"].get(k) for f in features] for k in keys}
    lines = []
    for f in features:
        flat, px, py = [], 0, 0
        for x, y in f["geometry"]["coordinates"]:
            ix, iy = round(x * scale), round(y * scale)
            flat += [ix - px, iy - py]
            px, py = ix, iy
        lines.append(flat)
    return dict(format=FORMAT, scale=scale, props=props, lines=lines)


def unpack(obj):
    """Packed dict (or plain GeoJSON) -> list of GeoJSON line features."""
    if obj.get("type") == "FeatureCollection":
        return obj["features"]
    scale, props, out = obj["scale"], obj["props"], []
    for i, flat in enumerate(obj["lines"]):
        x = y = 0
        coords = []
        for j in range(0, len(flat), 2):
            x += flat[j]
            y += flat[j + 1]
            coords.append([x / scale, y / scale])
        out.append(dict(type="Feature", properties={k: v[i] for k, v in props.items()},
                        geometry=dict(type="LineString", coordinates=coords)))
    return out


def read_features(path):
    return unpack(json.loads(Path(path).read_text()))


def dump(path, features, digits):
    """One line per map line, so a weekly re-run diffs (and compresses in git) line by line."""
    p = pack(features, digits)
    head = json.dumps({k: p[k] for k in ("format", "scale", "props")}, separators=(",", ":"), ensure_ascii=False)
    body = ",\n".join(json.dumps(l, separators=(",", ":")) for l in p["lines"])
    Path(path).write_text(head[:-1] + ',"lines":[\n' + body + "\n]}\n")


def digits_of(features):
    """Decimals the coordinates were written with (files store 4 or 5)."""
    best = 0
    for f in features[:200]:
        for c in f["geometry"]["coordinates"]:
            for v in c:
                s = repr(float(v))
                best = max(best, len(s.split(".")[1]) if "." in s else 0)
    return min(best, 6)


if __name__ == "__main__":
    for name in sys.argv[1:]:
        feats = read_features(name)
        dump(name, feats, digits_of(feats))
