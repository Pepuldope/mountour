from shapely.geometry import Point, shape

from pipeline.areas import build

COUNTRY = {"type": "Polygon", "coordinates": [[[17.0, 48.0], [20.0, 48.0], [20.0, 49.5], [17.0, 49.5], [17.0, 48.0]]]}


def trip(region, name, lon0, lat0):
    return dict(region=region, region_name=name, path=[[lon0 + i * 0.01, lat0 + i * 0.005] for i in range(30)])


def test_areas_split_the_whole_country():
    trips = [trip("west", "Západ a okolie", 17.3, 48.5), trip("east", "Východ", 19.4, 48.9), trip("dalsie", "Ďalšie miesta", 18.5, 48.2)]
    fc = build(trips, COUNTRY)
    by = {f["properties"]["id"]: f for f in fc["features"]}
    assert set(by) == {"west", "east"}
    assert by["west"]["properties"]["short"] == "Západ"
    # A spot far from any trail still belongs to the nearest area.
    assert shape(by["west"]["geometry"]).contains(Point(17.1, 49.4))
    assert shape(by["east"]["geometry"]).contains(Point(19.9, 48.1))
    # Together they cover nearly all of the country (minus the thin gaps between them).
    covered = sum(shape(f["geometry"]).area for f in fc["features"])
    assert covered > 0.95 * shape(COUNTRY).area
    w, s, e, n = by["east"]["properties"]["bbox"]
    assert w == 19.4 and s == 48.9


def test_outer_edge_follows_the_border_and_strays_join_a_neighbour():
    # A country with a notch, and one lone trail of "stray" inside the west's trails.
    country = {"type": "Polygon", "coordinates": [[[17.0, 48.0], [20.0, 48.0], [20.0, 49.5], [18.6, 49.5],
                                                   [18.5, 49.2], [18.4, 49.5], [17.0, 49.5], [17.0, 48.0]]]}
    stray = dict(region="stray", region_name="Zatúlané", path=[[17.452, 48.582], [17.455, 48.583]])
    trips = [trip("west", "Západ", 17.3, 48.5), trip("east", "Východ", 19.4, 48.9), stray]
    fc = build(trips, country)
    by = {f["properties"]["id"]: f for f in fc["features"]}
    assert set(by) == {"west", "east"}
    border = shape(country)
    union = shape(by["west"]["geometry"]).union(shape(by["east"]["geometry"]))
    # Nothing spills over the border, and the notch is followed, not cut across.
    assert union.difference(border).area < 1e-6
    assert not union.contains(Point(18.5, 49.4))
    assert union.area > 0.95 * border.area
