import json, math, urllib.request, urllib.parse
START = (48.19031, 17.08224)
UA = {"User-Agent": "mountour-diag/1 (github actions)"}
def get(url, data=None):
    req = urllib.request.Request(url, data=data, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())
def m(a, b):
    kx = 111320 * math.cos(math.radians(a[0])); return math.hypot((a[1]-b[1])*kx, (a[0]-b[0])*110540)
q = f"""[out:json][timeout:90];
(nwr(around:3500,{START[0]},{START[1]})[amenity=parking];
 nwr(around:3500,{START[0]},{START[1]})[name~"Červený most|Cerveny most"];
 way(around:3500,{START[0]},{START[1]})[name="Cesta mládeže"];
 node(around:3500,{START[0]},{START[1]})[barrier];);out center tags;"""
res = None
for host in ["https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"]:
    try:
        res = get(host, urllib.parse.urlencode({"data": q}).encode()); print("overpass ok", host); break
    except Exception as ex: print("overpass fail", host, ex)
for e in res["elements"]:
    t = e.get("tags", {}); c = e.get("center") or e
    if "lat" not in c: continue
    p = (c["lat"], c["lon"])
    print(e["type"], e["id"], (round(p[0],5), round(p[1],5)), round(m(START, p)), "m", t)
