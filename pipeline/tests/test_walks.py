"""The walks to the trail end where the site joins it (lib/trailJoin.ts) and stay out of the index."""

from pipeline import walks

# A trail going north from (48.0, 19.0), [lon, lat, ele].
PATH = [[19.0, 48.0 + i * 0.001, 500 + i] for i in range(21)]
START = {"lat": 48.0, "lon": 19.0}


def test_join_point_is_the_start_unless_joining_saves_100_m():
    near_start = {"lat": 48.0, "lon": 19.0005}
    assert walks.join_point(PATH, near_start, 40, START) == (48.0, 19.0)
    up_the_valley = {"lat": 48.015, "lon": 19.0005}  # beside the trail 1.6 km up
    lat, lon = walks.join_point(PATH, up_the_valley, 1670, START)
    assert abs(lat - 48.015) < 1e-6 and abs(lon - 19.0) < 1e-9


def test_add_routes_each_place_once_and_skips_ones_at_the_trail(monkeypatch):
    calls = []

    def fake_route(url, frm, to):
        calls.append((frm, to))
        return {"line": [[frm[1], frm[0]], [to[1], to[0]]], "m": 500, "min": 7}

    monkeypatch.setattr(walks, "route", fake_route)
    lot = {"location": {"lat": 48.0, "lon": 19.006}, "walk_m": 450}
    at_trail = {"location": {"lat": 48.0, "lon": 19.0002}, "walk_m": 15}
    trip = {"path": PATH, "start": {"location": START}, "parking": lot, "parking_alternatives": [at_trail],
            "transit": None, "transit_alternatives": []}
    twin = {**trip, "parking": dict(lot), "parking_alternatives": []}
    assert walks.add("http://osrm", [trip, twin], log=lambda *_: None) == 2
    assert len(calls) == 1
    assert trip["parking"]["walk"]["min"] == 7 and twin["parking"]["walk"]["m"] == 500
    assert "walk" not in at_trail


def test_index_summaries_leave_the_walks_in_the_trip_file():
    from pipeline import publish

    walk = {"line": [[19.0, 48.0]], "m": 1, "min": 1}
    summary = publish._without_walks({"parking": {"name": "P", "walk": walk}, "transit": None})
    assert "walk" not in summary["parking"]
