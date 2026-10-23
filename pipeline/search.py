"""The search index: every named place on or by a trip, and the trips that go there.

Trip names alone miss what people type: "Železná studnička" is a start of the Kamzík
trip and a few meters from Červený most, where other trips start. This collects the
starts, car parks, stops, huts, springs and sights of every trip (main routes and the
other routes to a place) into one list of places. The home search matches the typed
words against it, shows the matching places and the ones right next to them, and lists
the trips that touch any of them.

    python -m pipeline.search            # writes public/data/search.json from the trip files

Format (short keys, the file is fetched when someone starts typing):
  {"v": 1, "trips": [slug, ...], "places": [[name, lat, lon, kind, [trip index, ...]], ...]}
"""

import json
import sys
from pathlib import Path

from .geo import haversine
from .names import fold, is_junk

ROOT = Path(__file__).resolve().parent.parent
SAME_PLACE_M = 600  # one name this close is one place (a guidepost, its car park and its bus stop)
# Names that say what a thing is, not where: they find nothing useful.
GENERIC = {"parkovisko", "parking", "bufet", "chata", "zastavka", "pramen", "studnicka", "vyhliadka",
           "rozcestie", "ihrisko", "altanok", "pristresok", "utulna", "odpocivadlo", "restauracia", "kolkaren"}


def _points(t):
    """(name, lat, lon, kind) of everything named on a trip."""
    d = t.get("destination") or {}
    if d.get("location"):
        yield d.get("name"), d["location"]["lat"], d["location"]["lon"], d.get("kind") or "ine"
    for key, kind in (("start", "start"), ("parking", "parkovisko"), ("transit", "zastavka")):
        p = t.get(key) or {}
        if p.get("location"):
            yield p.get("name"), p["location"]["lat"], p["location"]["lon"], kind
    for p in [p for p in t.get("pois") or [] if not p.get("detour_min")]:  # side trips are not at the trip
        if p.get("location"):
            yield p.get("name"), p["location"]["lat"], p["location"]["lon"], p.get("kind") or "ine"


def build(trips):
    """trips: every published trip (main and other routes). Returns the index as a dict."""
    mains = [t for t in trips if not t.get("variant_of")]
    order = sorted(mains, key=lambda t: -t.get("rank", 0))
    index = {t["slug"]: i for i, t in enumerate(order)}
    places = []  # [name, lat, lon, kind, set(trip index)]
    by_name = {}
    for t in trips:
        ti = index.get(t.get("variant_of") or t["slug"])
        if ti is None:
            continue
        for name, lat, lon, kind in _points(t):
            name = (name or "").strip()
            key = fold(name)
            if not name or is_junk(name) or key in GENERIC or len(name) > 60:
                continue
            same = next((p for p in by_name.get(key, []) if haversine(lat, lon, p[1], p[2]) < SAME_PLACE_M), None)
            if same is None:
                same = [name, lat, lon, kind, set()]
                places.append(same)
                by_name.setdefault(key, []).append(same)
            elif kind != "start" and same[3] in ("start", "parkovisko", "zastavka"):
                same[3] = kind  # the hut or the peak says more than "a start"
            same[4].add(ti)
    places.sort(key=lambda p: (min(p[4]), p[0]))
    return dict(v=1, trips=[t["slug"] for t in order],
                places=[[n, round(la, 5), round(lo, 5), k, sorted(ts)] for n, la, lo, k, ts in places])


def load_trips(tdir):
    out = []
    for f in sorted(tdir.glob("*.json")):
        if f.name in ("index.json", "list.json"):
            continue
        out.append(json.loads(f.read_text()))
    return out


def write(root, trips):
    path = Path(root) / "public" / "data" / "search.json"
    path.write_text(json.dumps(build(trips), ensure_ascii=False, separators=(",", ":")) + "\n")
    return path


def main(argv=None):
    root = Path(argv[0]) if argv else ROOT
    path = write(root, load_trips(root / "public" / "data" / "trips"))
    data = json.loads(path.read_text())
    print(f"{path}: {len(data['places'])} places, {len(data['trips'])} trips, {path.stat().st_size // 1024} kB")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
