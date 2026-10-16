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


def test_candidates_cover_the_first_half_of_the_way_up():
    cands = walks.candidates(PATH, 20)  # ~2.2 km up
    assert cands[0][0] == walks.SHORTCUT_STEP_M
    assert cands[-1][0] <= 0.5 * 2224 + 1
    assert all(abs(lon - 19.0) < 1e-9 for _, (lat, lon) in cands)


def _osrm(monkeypatch, metres_to, calls):
    """A fake OSRM where the walk from anywhere to a point costs metres_to(point)."""

    def fake_table(url, frm, tos):
        return [metres_to(p) for p in tos]

    def fake_route(url, frm, to):
        calls.append(to)
        return {"line": [[frm[1], frm[0]], [to[1], to[0]]], "m": round(metres_to(to)), "min": 9}

    monkeypatch.setattr(walks, "table", fake_table)
    monkeypatch.setattr(walks, "route", fake_route)


def test_a_stop_with_a_path_straight_up_joins_the_trail_further_on(monkeypatch):
    # The stop is 500 m east of the start, but the road to it bends: 1.2 km to the start,
    # while a path from the stop reaches the trail 800 m up after 700 m.
    def metres_to(p):
        along = (p[0] - 48.0) * 111200
        return 1200 if along < 50 else 2 * abs(along - 800) + 700

    calls = []
    _osrm(monkeypatch, metres_to, calls)
    stop = {"location": {"lat": 48.0, "lon": 19.0067}, "walk_m": 500}
    trip = {"path": PATH, "route": "tam-a-spat", "turnaround_index": 20, "start": {"location": START},
            "parking": None, "parking_alternatives": [], "transit": stop, "transit_alternatives": []}
    assert walks.add("http://osrm", [trip], log=lambda *_: None) == 1
    lat, lon = calls[-1]
    assert abs((lat - 48.0) * 111200 - 800) < walks.SHORTCUT_STEP_M
    assert stop["walk"]["m"] < 800


def test_no_shortcut_when_it_saves_little_or_the_trip_is_a_loop(monkeypatch):
    calls = []
    # Joining further up saves only 100 m of the way up.
    _osrm(monkeypatch, lambda p: 600 if (p[0] - 48.0) * 111200 < 50 else 600 + (p[0] - 48.0) * 111200 - 100, calls)
    stop = {"location": {"lat": 48.0, "lon": 19.0067}, "walk_m": 500}
    trip = {"path": PATH, "route": "tam-a-spat", "turnaround_index": 20, "start": {"location": START},
            "parking": None, "parking_alternatives": [], "transit": stop, "transit_alternatives": []}
    walks.add("http://osrm", [trip], log=lambda *_: None)
    assert calls == [(48.0, 19.0)]

    calls.clear()
    _osrm(monkeypatch, lambda p: 1200 if (p[0] - 48.0) * 111200 < 50 else 700, calls)
    loop = {**trip, "route": "okruh", "transit": dict(stop)}
    walks.add("http://osrm", [loop], log=lambda *_: None)
    assert calls == [(48.0, 19.0)]


def test_a_walk_that_just_follows_the_trail_is_no_shortcut(monkeypatch):
    # OSRM cuts the trail's corners: 4 km up costs 3.7 km, but the walk is on the trail from the start.
    monkeypatch.setattr(walks, "table", lambda url, frm, tos: [80 if (p[0] - 48.0) * 111200 < 50 else 0.9 * (p[0] - 48.0) * 111200 for p in tos])
    calls = []

    def fake_route(url, frm, to):
        calls.append(to)
        return {"line": [[frm[1], frm[0]], [19.0, 48.0], [to[1], to[0]]], "m": 900, "min": 12}

    monkeypatch.setattr(walks, "route", fake_route)
    stop = {"location": {"lat": 47.9993, "lon": 19.0}, "walk_m": 80}
    trip = {"path": PATH, "route": "tam-a-spat", "turnaround_index": 20, "start": {"location": START},
            "parking": None, "parking_alternatives": [], "transit": stop, "transit_alternatives": []}
    walks.add("http://osrm", [trip], log=lambda *_: None)
    assert calls[-1] == (48.0, 19.0)


def test_trips_sharing_a_stop_each_get_a_way_in_to_their_own_trail(monkeypatch):
    def metres_to(p):
        along = (p[0] - 48.0) * 111200
        return 1200 if along < 50 else 2 * abs(along - 800) + 700

    calls = []
    _osrm(monkeypatch, metres_to, calls)
    west = [[19.0 - i * 0.0015, 48.0, 500] for i in range(21)]  # another goal, due west of the same start
    stop = {"location": {"lat": 48.0, "lon": 19.0067}, "walk_m": 500}
    north = {"slug": "north", "path": PATH, "route": "tam-a-spat", "turnaround_index": 20, "start": {"location": START},
             "parking": None, "parking_alternatives": [], "transit": stop, "transit_alternatives": []}
    other = {**north, "slug": "west", "path": west, "transit": dict(stop)}
    monkeypatch.setattr(walks, "table", lambda url, frm, tos: [metres_to(p) if abs(p[1] - 19.0) < 1e-9 else 1200 + (19.0 - p[1]) * 74500 for p in tos])
    walks.add("http://osrm", [north, other], log=lambda *_: None)
    assert north["transit"]["walk"]["line"][-1] != [19.0, 48.0]
    assert other["transit"]["walk"]["line"][-1] == [19.0, 48.0]
