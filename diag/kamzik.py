import json, math, urllib.request, urllib.parse
START = (48.19031, 17.08224)
FROM = [(48.1105, 17.1080), (48.1180, 17.1000), (48.1260, 17.1180)]
UA = {"User-Agent": "mountour-diag/1 (github actions)"}
def get(url, data=None):
    req = urllib.request.Request(url, data=data, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())
def m(a, b):
    kx = 111320 * math.cos(math.radians(a[0])); return math.hypot((a[1]-b[1])*kx, (a[0]-b[0])*110540)
q = f"""[out:json][timeout:60];
(nwr(around:1500,{START[0]},{START[1]})[amenity=parking];);out center tags;
way(around:400,{START[0]},{START[1]})[highway];out tags geom;"""
res = get("https://overpass-api.de/api/interpreter", urllib.parse.urlencode({"data": q}).encode())
parks = []
print("== parkings within 1500 m")
for e in res["elements"]:
    t = e.get("tags", {})
    if t.get("amenity") == "parking":
        c = (e.get("center") or e); p = (c["lat"], c["lon"])
        parks.append((e["type"], e["id"], p))
        print(e["type"], e["id"], p, round(m(START, p)), "m", {k: v for k, v in t.items()})
print("== roads within 400 m")
for e in res["elements"]:
    t = e.get("tags", {})
    if "highway" in t:
        g = e.get("geometry", [])
        d = min((m(START, (x["lat"], x["lon"])) for x in g), default=-1)
        print(e["id"], round(d), {k: t[k] for k in t if k in ("highway","name","access","motor_vehicle","motorcar","vehicle","service","tracktype","foot","oneway")})
OSRM = "https://router.project-osrm.org"
def nearest(p):
    r = get(f"{OSRM}/nearest/v1/driving/{p[1]},{p[0]}?number=1")
    w = r["waypoints"][0]; return round(w["distance"]), w.get("name"), (w["location"][1], w["location"][0])
print("== OSRM nearest")
print("start", nearest(START))
for t, i, p in parks:
    try: print(t, i, nearest(p))
    except Exception as ex: print(t, i, "err", ex)
def spurs(pts):
    out = []
    for i in range(len(pts)):
        acc = 0
        for j in range(i+1, min(len(pts), i+400)):
            acc += m(pts[j-1], pts[j])
            if acc > 60 and m(pts[i], pts[j]) < 12:
                out.append((i, j, round(acc), pts[i])); break
    return out
def route(base, prof, a, b):
    r = get(f"{base}/route/v1/{prof}/{a[1]},{a[0]};{b[1]},{b[0]}?overview=full&geometries=geojson")
    rt = r["routes"][0]; pts = [(y, x) for x, y in rt["geometry"]["coordinates"]]
    return rt, pts
for f in FROM:
    for name, dest in [("start", START)] + [(f"{t}{i}", p) for t, i, p in parks[:6]]:
        try:
            rt, pts = route(OSRM, "driving", f, dest)
            end = pts[-1]
            print(f"drive {f}->{name}: {round(rt['distance'])} m, end {end} gap {round(m(end, dest))} m, spurs {spurs(pts)[:5]}")
            print("   last 15:", [tuple(round(c,5) for c in p) for p in pts[-15:]])
        except Exception as ex: print("drive err", name, ex)
    try:
        rt, pts = route(OSRM, "driving", f, START); end = pts[-1]
        rt2, pts2 = route("https://routing.openstreetmap.de/routed-foot", "driving", end, START)
        print(f"  foot tail from drive end to start: {round(rt2['distance'])} m, spurs {spurs(pts2)}")
        print("   pts:", [tuple(round(c,5) for c in p) for p in pts2])
    except Exception as ex: print("tail err", ex)
