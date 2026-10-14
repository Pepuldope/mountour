"""The walk from each parking spot and stop to the trail, on paths, from a local OSRM (foot profile).

The trip page draws this walk and used to ask OpenRouteService for it on every
visit (free key: 40 routes a minute). The walk is the same for everyone, so it
is worked out here once a week and stored on the parking or stop itself:

    "walk": {"line": [[lon, lat], ...], "m": 420, "min": 6}

It ends where the site joins the trail (lib/trailJoin.ts, ported below): the
trail's nearest point when that saves at least 100 m, else the trail start.
"""

import json
import math
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from .geo import LocalProjection, haversine, rdp_indices

# lib/trailJoin.ts MIN_SAVING_M: joining part-way must save this much walking, or the start it is.
MIN_SAVING_M = 100
# components/TripMap.tsx AT_TRAIL_M: closer than this, there is no walk to draw.
AT_TRAIL_M = 60
# Fewer points with the shape kept (as /api/drive draws the road).
SHAPE_TOL_M = 2
# A "walk" over this is a wrong snap, not the way in (/api/walk refuses past 5 km too).
MAX_WALK_M = 5000


def _nearest_on_path(path, lat, lon):
    """lib/geo.ts nearestOnPath: (segment i, t, point (lat, lon), metres) of the closest point."""
    kx = 111320 * math.cos(math.radians(lat))
    ky = 110540
    best = (0, 0.0, (path[0][1], path[0][0]), float(haversine(path[0][1], path[0][0], lat, lon)))
    for i in range(len(path) - 1):
        ax, ay = (path[i][0] - lon) * kx, (path[i][1] - lat) * ky
        bx, by = (path[i + 1][0] - lon) * kx, (path[i + 1][1] - lat) * ky
        dx, dy = bx - ax, by - ay
        len2 = dx * dx + dy * dy
        t = min(1.0, max(0.0, -(ax * dx + ay * dy) / len2)) if len2 > 0 else 0.0
        d = math.hypot(ax + t * dx, ay + t * dy)
        if d < best[3] - 1e-9:
            a, b = path[i], path[i + 1]
            best = (i, t, (a[1] + t * (b[1] - a[1]), a[0] + t * (b[0] - a[0])), d)
    return best


def join_point(path, place, walk_m, start):
    """Where the walk from `place` meets the trail, as the site works it out: (lat, lon)."""
    start = (start["lat"], start["lon"])
    if len(path) < 2:
        return start
    i, t, point, d = _nearest_on_path(path, place["lat"], place["lon"])
    if (i == 0 and t == 0) or d > walk_m - MIN_SAVING_M:
        return start
    return (round(point[0], 6), round(point[1], 6))


def _simplify(coords):
    """[[lon, lat], ...] with points closer than SHAPE_TOL_M to the line dropped, 5 decimals (~1 m)."""
    if len(coords) <= 2:
        return [[round(x, 5), round(y, 5)] for x, y in coords]
    lon, lat = np.asarray(coords, float).T
    keep = rdp_indices(LocalProjection(float(lat.mean())).xy(lat, lon), SHAPE_TOL_M)
    return [[round(coords[k][0], 5), round(coords[k][1], 5)] for k in keep]


def route(osrm_url, frm, to):
    """One walk from (lat, lon) to (lat, lon), or None when OSRM finds none."""
    url = (f"{osrm_url.rstrip('/')}/route/v1/foot/{frm[1]},{frm[0]};{to[1]},{to[0]}"
           "?overview=full&geometries=geojson")
    with urllib.request.urlopen(url, timeout=60) as r:
        res = json.loads(r.read())
    if res.get("code") != "Ok" or not res.get("routes"):
        return None
    best = res["routes"][0]
    if best["distance"] > MAX_WALK_M:
        return None
    return {"line": _simplify(best["geometry"]["coordinates"]), "m": int(round(best["distance"])),
            "min": max(1, int(round(best["duration"] / 60)))}


def add(osrm_url, trips, log=print, workers=8):
    """Set "walk" on every parking and stop of every trip (in place). Returns how many got one."""
    jobs = {}  # (from, to) -> objects that share that walk
    for t in trips:
        path = t.get("path") or []
        if not path:
            continue
        places = [t.get("parking"), *t.get("parking_alternatives", []), t.get("transit"), *t.get("transit_alternatives", [])]
        for p in places:
            if not p:
                continue
            p.pop("walk", None)
            loc = p["location"]
            to = join_point(path, loc, p["walk_m"], t["start"]["location"])
            if haversine(loc["lat"], loc["lon"], *to) <= AT_TRAIL_M:
                continue
            jobs.setdefault(((loc["lat"], loc["lon"]), to), []).append(p)

    def one(key):
        try:
            return key, route(osrm_url, *key)
        except Exception as err:  # noqa: BLE001 - one bad walk must not stop the weekly run
            log(f"walk {key}: {err}")
            return key, None

    done = 0
    with ThreadPoolExecutor(workers) as pool:
        for n, (key, walk) in enumerate(pool.map(one, list(jobs)), start=1):
            if walk:
                for p in jobs[key]:
                    p["walk"] = walk
                done += len(jobs[key])
            if n % 2000 == 0:
                log(f"walks: {n}/{len(jobs)}")
    log(f"walks: {done} parking spots and stops have one ({len(jobs)} distinct)")
    return done
