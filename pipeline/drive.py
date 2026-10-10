"""Drive-time table towns x trips from a local OSRM server (car profile, OSM data)."""

import json
import urllib.request

from .geo import slugify

CHUNK = 90  # destinations per request; sources are all towns


def towns(osm):
    seen = {}
    out = []
    for f in sorted(osm.towns, key=lambda f: -_pop(f)):
        tid = slugify(f.name)
        if tid in seen:
            continue
        seen[tid] = True
        out.append(dict(id=tid, name=f.name, location=dict(lat=round(f.lat, 5), lon=round(f.lon, 5))))
    return sorted(out, key=lambda t: t["id"])


def table(osrm_url, town_list, trips, log=print):
    """minutes[town][trip], km[town][trip]; None where OSRM finds no route."""
    dests = [t["parking"]["location"] if t["parking"] else t["start"]["location"] for t in trips]
    minutes = [[None] * len(trips) for _ in town_list]
    km = [[None] * len(trips) for _ in town_list]
    src = ";".join(f"{t['location']['lon']},{t['location']['lat']}" for t in town_list)
    for c0 in range(0, len(dests), CHUNK):
        chunk = dests[c0 : c0 + CHUNK]
        coords = src + ";" + ";".join(f"{d['lon']},{d['lat']}" for d in chunk)
        n = len(town_list)
        url = (f"{osrm_url.rstrip('/')}/table/v1/driving/{coords}"
               f"?sources={';'.join(map(str, range(n)))}"
               f"&destinations={';'.join(map(str, range(n, n + len(chunk))))}"
               f"&annotations=duration,distance")
        with urllib.request.urlopen(url, timeout=600) as r:
            res = json.loads(r.read())
        if res.get("code") != "Ok":
            raise RuntimeError(f"OSRM: {res.get('code')} {res.get('message')}")
        for i in range(n):
            for j in range(len(chunk)):
                d = res["durations"][i][j]
                m = res["distances"][i][j]
                minutes[i][c0 + j] = None if d is None else int(round(d / 60))
                km[i][c0 + j] = None if m is None else round(m / 1000, 1)
        log(f"drive table: {min(c0 + CHUNK, len(dests))}/{len(dests)} trips")
    return minutes, km


def _pop(f):
    try:
        return int(str(f.tags.get("population", "0")).replace(" ", ""))
    except ValueError:
        return 0


class CarCheck:
    """True when OSRM can snap a parking to a public car road within max_m (private roads are not routable)."""

    def __init__(self, osrm_url, max_m):
        self.url = osrm_url.rstrip("/")
        self.max_m = max_m
        self.cache = {}
        self.checked = 0
        self.rejected = 0

    def __call__(self, f):
        if f.osm not in self.cache:
            self.checked += 1
            try:
                with urllib.request.urlopen(f"{self.url}/nearest/v1/driving/{f.lon},{f.lat}?number=1", timeout=30) as r:
                    res = json.loads(r.read())
                ok = res.get("code") == "Ok" and res["waypoints"][0]["distance"] <= self.max_m
            except Exception:
                ok = True  # never drop data because the checker failed
            self.rejected += not ok
            self.cache[f.osm] = ok
        return self.cache[f.osm]
