"""Trail network for the map: pieces, popularity levels and the files the site reads."""

import json

import numpy as np

from pipeline import network
from pipeline.tests.test_pipeline import osm_xml


def test_levels_follow_trail_length():
    heat = np.array([0.0, 1.0, 2.0, 3.0, 100.0])
    length = np.array([400.0, 250.0, 180.0, 110.0, 60.0])
    lv, cuts = network.levels(heat, length)
    assert lv.tolist() == [0, 1, 2, 3, 4]
    assert len(cuts) == 4


def test_split_way_keeps_pieces_short_and_connected():
    lats = np.linspace(48.0, 48.05, 60)  # ~5.5 km
    lons = np.full(60, 19.0)
    _, pieces = network.split_way(dict(lats=lats, lons=lons))
    assert all(p[2] <= network.PIECE_M + 120 for p in pieces)
    assert pieces[0][0] == 0 and pieces[-1][1] == 59
    assert all(a[1] == b[0] for a, b in zip(pieces, pieces[1:]))


def test_heat_falls_off_with_distance():
    goals = network.to_xy([48.0], [19.0])
    near, far = network.to_xy([48.0, 48.05], [19.01, 19.0])
    h = network.heat_at(np.array([near, far]), goals, np.array([1000.0]))
    assert h[0] > h[1] > 0


def test_end_to_end(tmp_path):
    xml = osm_xml().replace('wikipedia="sk:Testovací vrch"', 'wikidata="Q1"').replace(
        '<tag k="wikipedia" v="sk:Testovací vrch"/>', '<tag k="wikidata" v="Q1"/>'
    )
    pbf = tmp_path / "t.osm"
    pbf.write_text(xml)
    ways, goals = network.read(str(pbf))
    assert {w["id"] for w in ways} == {1000, 2000, 2001}
    assert next(w for w in ways if w["id"] == 1000)["colours"] == {"red"}
    assert [g["qid"] for g in goals] == ["Q1"]

    runs, stats = network.build(ways, goals, {"Q1": 5000})
    meta = network.write(tmp_path, ways, runs, stats)
    out = tmp_path / "public" / "data" / "trails"
    overview = json.loads((out / "overview.json").read_text())
    assert overview["features"] and all(0 <= f["properties"]["p"] <= 4 for f in overview["features"])
    # the trail at the famous peak is busier than the gorge 100 km away
    by_colour = {f["properties"]["c"]: f["properties"]["p"] for f in overview["features"]}
    assert by_colour["red"] > by_colour["green"]
    assert meta["cells"] and all((out / "c" / f"{c}.json").exists() for c in meta["cells"])
    assert meta["top_goals"][0]["name"] == "Testovací vrch"
