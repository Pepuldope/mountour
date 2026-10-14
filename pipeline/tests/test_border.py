import json

from shapely.geometry import MultiPolygon, Polygon

from pipeline import border


def test_writes_the_largest_part_as_one_ring(tmp_path):
    big = Polygon([(17, 48), (22, 48), (22, 49.5), (17, 49.5)])
    small = Polygon([(16, 47), (16.1, 47), (16.1, 47.1)])
    n = border.write(tmp_path, MultiPolygon([small, big]))
    f = json.loads((tmp_path / "public/data/map/border.json").read_text())
    ring = f["geometry"]["coordinates"][0]
    assert f["geometry"]["type"] == "Polygon" and n == len(ring) == 5
    assert ring[0] == ring[-1] and {tuple(p) for p in ring} == {(17, 48), (22, 48), (22, 49.5), (17, 49.5)}
