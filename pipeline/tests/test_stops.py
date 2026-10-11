"""Stops for "where to catch the bus from your start"."""

import json

from pipeline import stops
from pipeline.tests.test_pipeline import osm_xml


def test_dedupe_merges_platforms_of_one_stop():
    rows = [
        dict(name="Dolina, ihrisko", mode="autobus", lat=48.0, lon=19.0),
        dict(name="Dolina, ihrisko", mode="autobus", lat=48.0004, lon=19.0004),  # other side of the road
        dict(name="Dolina, ihrisko", mode="autobus", lat=48.05, lon=19.0),  # same name, another village
        dict(name="Dolina", mode="vlak", lat=48.0, lon=19.0),
    ]
    out = stops.dedupe(rows)
    assert len(out) == 3
    merged = next(s for s in out if s["mode"] == "autobus" and s["lat"] < 48.01)
    assert abs(merged["lat"] - 48.0002) < 1e-9


def test_end_to_end(tmp_path):
    pbf = tmp_path / "t.osm"
    pbf.write_text(osm_xml())
    found = stops.dedupe(stops.read(str(pbf)))
    assert [s["name"] for s in found] == ["Studnička"]
    meta = stops.write(tmp_path, found)
    assert meta["counts"]["autobus"] == 1
    cell = json.loads((tmp_path / "public" / "data" / "stops" / f"{meta['cells'][0]}.json").read_text())
    assert cell == [["Studnička", "a", 48.1905, 17.0822]]
