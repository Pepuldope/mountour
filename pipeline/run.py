"""Run the trip pipeline.

    python -m pipeline.run --pbf slovakia-latest.osm.pbf --dem pipeline/.cache/dem \
        [--osrm http://localhost:5000] [--wikidata] [--root .]
"""

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

import yaml

from . import drive as drive_mod
from . import osm as osm_mod
from . import publish
from .dem import Dem
from .graph import Graph
from .rules import RuleMatcher
from .trips import TripBuilder

UA = "MounTour trip pipeline (https://github.com/Pepuldope/mountour)"


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", file=sys.stderr, flush=True)


def sitelinks(qids):
    """Wikipedia article counts per Wikidata id (used for ranking only; failures are ignored)."""
    out = {}
    qids = sorted(set(qids))
    for i in range(0, len(qids), 50):
        url = ("https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&format=json&ids="
               + "|".join(qids[i : i + 50]))
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                ents = json.loads(r.read())["entities"]
            for q, e in ents.items():
                out[q] = len([k for k in e.get("sitelinks", {}) if k.endswith("wiki") and k != "commonswiki"])
        except Exception as e:  # ranking still works without it
            log(f"wikidata: {e}")
            break
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--pbf", required=True)
    ap.add_argument("--dem", default=None, help="folder with Copernicus DEM tiles")
    ap.add_argument("--osrm", default=None, help="OSRM server URL for the drive table")
    ap.add_argument("--wikidata", action="store_true")
    ap.add_argument("--root", default=".")
    ap.add_argument("--osm-timestamp", default=None)
    ap.add_argument("--force", action="store_true", help="publish even if the trip count dropped a lot")
    a = ap.parse_args(argv)
    root = Path(a.root)

    cfg = yaml.safe_load((root / "pipeline" / "config.yaml").read_text())
    closures = json.loads((root / "data" / "closure-rules.json").read_text())["rules"]
    fees = json.loads((root / "data" / "fee-rules.json").read_text())["rules"]
    overrides = yaml.safe_load((root / "pipeline" / "overrides.yaml").read_text()) or {}
    slugs_file = root / "pipeline" / "slugs.json"
    slugs = json.loads(slugs_file.read_text()) if slugs_file.exists() else {}
    probe_names = {n for r in closures + fees for n in (r.get("selector") or {}).get("probes", [])}
    boxes = [b for r in cfg["regions"] for b in r["bboxes"]]

    log("reading OSM")
    osm = osm_mod.load(a.pbf, boxes, probe_names)
    log(f"routes {len(osm.routes)}, ways {len(osm.ways)}, guideposts {len(osm.guideposts)}, parking {len(osm.parking)}, "
        f"stops {len(osm.stops)}, destinations {len(osm.destinations)}, towns {len(osm.towns)}, border {'yes' if osm.border is not None else 'no'}")
    graph = Graph(osm)
    log(f"graph: {graph.n} nodes, {len(graph.edge_key)} edges")
    dem = Dem(a.dem) if a.dem else None
    if dem and not dem.available:
        log("no DEM tiles found, ascent falls back to OSM elevations")
        dem = None

    links = sitelinks([f.tags["wikidata"] for _, f in osm.destinations if f.tags.get("wikidata")]) if a.wikidata else {}
    cm, fm = RuleMatcher(closures, osm.probes), RuleMatcher(fees, osm.probes)
    tb = TripBuilder(cfg, osm, graph, dem, cm, fm, slugs, links, log)
    trips = tb.build()
    trips = apply_overrides(trips, overrides)
    tb.report["unresolved"] = {**cm.unresolved, **fm.unresolved}
    log(f"{len(trips)} trips")

    prev = root / "data" / "trips" / "index.json"
    if prev.exists() and not a.force:
        n_prev = len(json.loads(prev.read_text())["trips"])
        if n_prev >= 20 and len(trips) < 0.7 * n_prev:
            log(f"trip count fell from {n_prev} to {len(trips)}: refusing to publish (use --force)")
            return 1

    drive = None
    if a.osrm:
        town_list = drive_mod.towns(osm)
        minutes, km = drive_mod.table(a.osrm, town_list, trips, log)
        drive = (town_list, minutes, km, "OSRM car profile on OpenStreetMap data")

    publish.write(root, trips, dem, drive, slugs, tb.report, a.osm_timestamp)
    log("done")
    return 0


def apply_overrides(trips, overrides):
    drop = set(overrides.get("drop", []) or [])
    edits = overrides.get("trips", {}) or {}
    out = []
    for t in trips:
        if t["slug"] in drop:
            continue
        for k in ("name", "description"):
            if edits.get(t["slug"], {}).get(k):
                t[k] = edits[t["slug"]][k]
        out.append(t)
    return out


if __name__ == "__main__":
    sys.exit(main())
