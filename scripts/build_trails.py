#!/usr/bin/env python3
"""Build MounTour's trail data from real open map data.

For every trail in TRAILS below:
  1. the on-foot track is routed by BRouter (hiking-mountain profile, which sticks
     to marked/hiking paths) from the trailhead to the destination and back,
  2. parking lots and public-transport stops near the trailhead, and POIs along
     the track, are pulled from OpenStreetMap via Overpass,
  3. distance, ascent, duration (DIN 33466) and difficulty are computed.

Outputs (all overwritten): public/gpx/<slug>.gpx, supabase/seed.sql,
data/fixtures/trails.json. Network responses are cached in scripts/.cache so
re-runs are fast and don't hammer the public servers.

Closures are deliberately NOT generated: only add a closure row by hand, with a
real source_url. No row -> the UI says „Stav chodníka neoverený".

Usage:  python3 scripts/build_trails.py
"""

import datetime as dt
import hashlib
import json
import math
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache"
UA = "MounTour/0.1 (maturita school project; https://github.com/Pepuldope/mountour)"
OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
NS = uuid.UUID("6f1c9a52-2d0e-4b8e-9a51-7d3f0c2b1e10")  # stable ids across re-runs

# start = KST guidepost (or village centre) at the trailhead; dest = the goal.
# dest may instead be an Overpass selector, resolved at build time.
TRAILS = [
    dict(slug="devinska-kobyla", name="Devínska Kobyla z Devína",
         start=("Devín, pod hradom", 48.17547, 16.97993),
         dest=("Devínska Kobyla, rozhľadňa", 48.18937, 16.99553),
         family=False,
         description="Výstup z Devína pod hradom na najvyšší vrch Devínskych Karpát s rozhľadňou. Výhľad na sútok Moravy a Dunaja."),
    dict(slug="kamzik", name="Kamzík zo Železnej studničky",
         start=("Železná studnička", 48.19031, 17.08224),
         dest=("Kamzík", 48.18185, 17.09337),
         family=True,
         description="Krátky výstup lesom zo Železnej studničky na Kamzík k televíznej veži. Na vrchole bufety a lesný park."),
    dict(slug="biely-kriz", name="Biely kríž z Krasnian",
         start=("Pekná cesta, Záhrady", 48.19876, 17.13477),
         dest=("Biely kríž", 48.24843, 17.14420),
         family=False,
         description="Z konečnej električky v Krasňanoch hrebeňom Malých Karpát na Biely kríž, obľúbený uzol turistických a cyklistických trás."),
    dict(slug="pajstun", name="Hrad Pajštún z Borinky",
         start=("Borinka", 48.26265, 17.08605),
         dest=("Hrad Pajštún", 48.27542, 17.08287),
         family=True,
         description="Krátky, miestami strmý výstup z Borinky k zrúcanine hradu Pajštún na skalnom brale."),
    dict(slug="vysoka", name="Vysoká z Kuchyne",
         start=("Kuchyňa, kostol", 48.40660, 17.15581),
         dest=("Vysoká", 48.41639, 17.21714),
         family=False,
         description="Výstup z Kuchyne na Vysokú, jeden z najvyšších vrchov Malých Karpát, s výhľadom zo skalného vrcholu."),
    dict(slug="velka-homola", name="Veľká Homoľa od Zochovej chaty",
         start=("Zochova chata, parkovisko", 48.38083, 17.27941),
         dest=("Veľká Homoľa", 48.36322, 17.26113),  # OSM node 1076824590 ("Veľká homoľa")
         family=True,
         description="Nenáročná prechádzka od Zochovej chaty na Veľkú Homoľu s drevenou rozhľadňou."),
    dict(slug="zaruby", name="Záruby zo Smoleníc",
         start=("Smolenice, pod zámkom", 48.50918, 17.43355),
         dest=("Záruby", 48.52346, 17.39271),
         family=False,
         description="Výstup od Smolenického zámku na Záruby, najvyšší vrch Malých Karpát."),
    dict(slug="plavecky-hrad", name="Plavecký hrad z Plaveckého Podhradia",
         start=("Plavecké Podhradie", 48.48305, 17.26000),
         dest=("Plavecký hrad", 48.49398, 17.26866),
         family=True,
         description="Krátky výstup z obce k zrúcanine Plaveckého hradu nad Záhorím."),
    dict(slug="cerveny-kamen", name="Červený Kameň z Častej",
         start=("Častá", 48.39881, 17.35685),
         dest=("Hrad Červený Kameň", 48.39158, 17.33553),
         family=True,
         description="Prechádzka z Častej k hradu Červený Kameň a zámockému parku."),
    dict(slug="cachticky-hrad", name="Čachtický hrad z Čachtíc",
         start=("Čachtice", 48.71419, 17.78629),
         dest=("Čachtický hrad", 48.72490, 17.76119),
         family=True,
         description="Z obce Čachtice k zrúcanine Čachtického hradu na severnom okraji Malých Karpát."),
]


# ---------------------------------------------------------------- network ---

def _cached(key: str, fetch):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / (hashlib.sha1(key.encode()).hexdigest() + ".json")
    if f.exists():
        return json.loads(f.read_text())
    data = fetch()
    f.write_text(json.dumps(data))
    return data


def _get(url: str, data: bytes | None = None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def overpass(q: str):
    def fetch():
        last = None
        for attempt in range(6):
            url = OVERPASS[attempt % len(OVERPASS)]
            try:
                return _get(url, urllib.parse.urlencode({"data": q}).encode())
            except Exception as e:  # 429/504/garbage -> next mirror
                last = e
                time.sleep(5 * (attempt + 1))
        raise RuntimeError(f"Overpass failed: {last}")
    return _cached("overpass:" + q, fetch)


def brouter(points):
    lonlats = "|".join(f"{lon},{lat}" for lat, lon in points)
    url = ("https://brouter.de/brouter?" + urllib.parse.urlencode(
        {"lonlats": lonlats, "profile": "hiking-mountain", "alternativeidx": 0, "format": "geojson"}))
    return _cached("brouter:" + url, lambda: _get(url))


# ------------------------------------------------------------------- math ---

def haversine(a, b):
    R = 6371000
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def din33466_minutes(dist_m, up_m, down_m):
    """German/Alpine standard hiking time: 4 km/h, 300 m/h up, 500 m/h down."""
    horiz = dist_m / 4000
    vert = up_m / 300 + down_m / 500
    hours = max(horiz, vert) + min(horiz, vert) / 2
    return int(math.ceil(hours * 60 / 15) * 15)


def difficulty(dist_m, up_m):
    if dist_m > 14000 or up_m > 650:
        return "tazka"
    if dist_m > 7000 or up_m > 300:
        return "stredna"
    return "lahka"


def simplify(track, n=80):
    step = max(1, len(track) // n)
    return track[::step] + [track[-1]]


# ----------------------------------------------------------------- build ---

POI_KIND = [
    (lambda t: t.get("tourism") == "viewpoint" or t.get("tower:type") == "observation", "vyhliadka"),
    (lambda t: t.get("historic") in ("castle", "ruins"), "hrad"),
    (lambda t: t.get("tourism") in ("alpine_hut", "wilderness_hut", "chalet") or t.get("amenity") == "shelter", "chata"),
    (lambda t: t.get("amenity") in ("restaurant", "pub", "fast_food", "cafe"), "obcerstvenie"),
    (lambda t: t.get("natural") == "spring" or t.get("amenity") == "drinking_water", "pramen"),
    (lambda t: t.get("leisure") == "playground", "ihrisko"),
]


def resolve_dest(dest):
    name, *rest = dest
    if len(rest) == 2:
        return name, rest[0], rest[1]
    els = overpass(f"[out:json][timeout:60];{rest[0]};out center tags;")["elements"]
    if not els:
        raise SystemExit(f"Destination not found in OSM: {name}")
    e = els[0]
    return name, e.get("lat") or e["center"]["lat"], e.get("lon") or e["center"]["lon"]


def center(e):
    return (e.get("lat") or e["center"]["lat"], e.get("lon") or e["center"]["lon"])


def build_one(cfg, today):
    slug = cfg["slug"]
    s_name, s_lat, s_lon = cfg["start"]
    d_name, d_lat, d_lon = resolve_dest(cfg["dest"])

    gj = brouter([(s_lat, s_lon), (d_lat, d_lon), (s_lat, s_lon)])
    feat = gj["features"][0]
    props = feat["properties"]
    track = [(c[1], c[0], c[2] if len(c) > 2 else None) for c in feat["geometry"]["coordinates"]]
    dist = int(float(props["track-length"]))
    up = int(float(props["filtered ascend"]))
    duration = din33466_minutes(dist, up, up)  # out-and-back: down == up

    lats = [p[0] for p in track]
    lons = [p[1] for p in track]
    bbox = {"sw": {"lat": round(min(lats), 5), "lon": round(min(lons), 5)},
            "ne": {"lat": round(max(lats), 5), "lon": round(max(lons), 5)}}

    # GPX
    gpx = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<gpx version="1.1" creator="MounTour (BRouter + OpenStreetMap)" xmlns="http://www.topografix.com/GPX/1/1">',
           f'  <metadata><name>{cfg["name"]}</name><copyright author="OpenStreetMap contributors"><license>https://opendatacommons.org/licenses/odbl/</license></copyright></metadata>',
           f'  <trk><name>{cfg["name"]}</name><trkseg>']
    for lat, lon, ele in track:
        gpx.append(f'    <trkpt lat="{lat:.6f}" lon="{lon:.6f}">' + (f"<ele>{ele}</ele>" if ele is not None else "") + "</trkpt>")
    gpx += ["  </trkseg></trk>", "</gpx>", ""]
    (ROOT / "public" / "gpx" / f"{slug}.gpx").write_text("\n".join(gpx))

    # OSM features: parking + transit near the trailhead, POIs along the track
    line = ",".join(f"{lat:.5f},{lon:.5f}" for lat, lon, _ in simplify(track))
    q = f"""[out:json][timeout:90];
(
  nwr["amenity"="parking"]["access"!~"private|no|customers"](around:800,{s_lat},{s_lon});
  nwr["amenity"="parking"]["access"!~"private|no|customers"]["parking"!="street_side"](around:300,{line});
  node["highway"="bus_stop"]["name"](around:1000,{s_lat},{s_lon});
  node["railway"~"^(tram_stop|station|halt)$"]["name"](around:1000,{s_lat},{s_lon});
  nwr["name"]["tourism"~"^(viewpoint|alpine_hut|wilderness_hut|chalet)$"](around:150,{line});
  nwr["name"]["man_made"="tower"]["tower:type"="observation"](around:150,{line});
  nwr["name"]["historic"~"^(castle|ruins)$"](around:150,{line});
  nwr["name"]["amenity"~"^(shelter|restaurant|pub|fast_food|cafe|drinking_water)$"](around:150,{line});
  nwr["name"]["natural"="spring"](around:150,{line});
  nwr["name"]["leisure"="playground"](around:150,{line});
);
out center tags;"""
    els = overpass(q)["elements"]

    start = (s_lat, s_lon)
    th_id = str(uuid.uuid5(NS, slug + ":trailhead"))
    trail_id = str(uuid.uuid5(NS, slug))

    parkings, stops, pois = [], {}, {}
    for e in els:
        t = e.get("tags", {})
        loc = center(e)
        d = haversine(start, loc)
        if t.get("amenity") == "parking":
            parkings.append((d, e, loc))
        elif t.get("highway") == "bus_stop" or t.get("railway") in ("tram_stop", "station", "halt"):
            mode = "vlak" if t.get("railway") in ("station", "halt") else "elektricka" if t.get("railway") == "tram_stop" else "autobus"
            if "vláčik" in t["name"].lower():  # tourist trains tagged as bus stops
                continue
            t = dict(t, name=", ".join(p.strip() for p in t["name"].split(",") if p.strip()))
            key = (t["name"], mode)
            if key not in stops or d < stops[key][0]:
                stops[key] = (d, t["name"], mode, loc)
        else:
            kind = next((k for test, k in POI_KIND if test(t)), None)
            if kind and t["name"] not in pois:
                pois[t["name"]] = (kind, t["name"], loc, e["type"] + "/" + str(e["id"]))

    # Parking: anywhere near the route counts, since an out-and-back can be started from
    # either end (e.g. Kamzík: the mapped lots are at the summit end, not at Železná studnička).
    # Rank by how far you'd walk from the car to the track, then prefer bigger lots.
    seen, ranked = set(), []
    for _, e, loc in parkings:
        if e["id"] in seen:
            continue
        seen.add(e["id"])
        i_near, d_track = min(((i, haversine(loc, (p[0], p[1]))) for i, p in enumerate(track)), key=lambda x: x[1])
        along = sum(haversine(track[i], track[i + 1]) for i in range(min(i_near, len(track) // 2 if i_near > len(track) // 2 else i_near)))
        if i_near > len(track) // 2:  # second half of an out-and-back: measure from the start the other way
            along = sum(haversine(track[i], track[i + 1]) for i in range(i_near, len(track) - 1))
        cap = int(e.get("tags", {}).get("capacity", "0") or 0) if str(e.get("tags", {}).get("capacity", "0")).isdigit() else 0
        ranked.append((d_track - min(cap, 50) * 2, d_track, along, e, loc))
    ranked.sort(key=lambda x: x[0])
    parking_rows = []
    for _, d_track, along, e, loc in ranked[:2]:
        t = e.get("tags", {})
        surface = {"asphalt": "asfalt", "paved": "spevnene", "gravel": "štrk", "fine_gravel": "štrk", "unpaved": "nespevnene",
                   "ground": "nespevnene", "grass": "tráva", "paving_stones": "dlažba"}.get(t.get("surface", ""), None)
        fee = {"yes": "spoplatnené", "no": "bezplatné"}.get(t.get("fee", ""))
        if along < 300:
            where = f"{round(haversine(start, loc))} m od začiatku trasy"
            title = f"Parkovisko {round(haversine(start, loc))} m od začiatku trasy"
        else:
            where = f"{round(d_track)} m od trasy, {along / 1000:.1f} km od začiatku – trasu môžete začať aj odtiaľto"
            title = f"Parkovisko pri trase ({along / 1000:.1f} km od začiatku)"
        note_bits = [where]
        if t.get("capacity", "").isdigit():
            note_bits.append(f"cca {t['capacity']} miest")
        if fee:
            note_bits.append(fee)
        parking_rows.append(dict(
            id=str(uuid.uuid5(NS, f"{slug}:parking:{e['type']}/{e['id']}")),
            trailhead_id=th_id,
            name=t.get("name") or title,
            location={"lat": round(loc[0], 6), "lon": round(loc[1], 6)},
            surface_type=surface,
            note=", ".join(note_bits) + ". Zdroj: OpenStreetMap.",
            verified_on=today,
            _order=along,
        ))
    parking_rows.sort(key=lambda p: p.pop("_order"))

    stop_rows = []
    for d, name, mode, loc in sorted(stops.values())[:3]:
        stop_rows.append(dict(
            id=str(uuid.uuid5(NS, f"{slug}:stop:{name}:{mode}")),
            trailhead_id=th_id, name=name, mode=mode,
            location={"lat": round(loc[0], 6), "lon": round(loc[1], 6)},
            distance_m=int(round(d)),
        ))

    # Sights first; food is everywhere in villages, so keep at most two places to eat.
    rank = {"vyhliadka": 0, "hrad": 1, "chata": 2, "pramen": 3, "ihrisko": 4, "obcerstvenie": 5}
    picked, food = [], 0
    for k, n, l, osm in sorted(pois.values(), key=lambda p: rank[p[0]]):
        if k == "obcerstvenie":
            if food >= 2:
                continue
            food += 1
        picked.append((k, n, l, osm))
    poi_rows = [dict(id=str(uuid.uuid5(NS, f"{slug}:poi:{osm}")), trail_id=trail_id, kind=k, name=n,
                     location={"lat": round(l[0], 6), "lon": round(l[1], 6)}, note=None)
                for k, n, l, osm in picked[:7]]

    detail = dict(
        trail=dict(id=trail_id, name=cfg["name"], slug=slug, description=cfg["description"],
                   distance_m=dist, ascent_m=up, difficulty=difficulty(dist, up),
                   duration_min=duration, family_friendly=cfg["family"],
                   gpx_path=f"gpx/{slug}.gpx", bbox=bbox, created_at=f"{today}T00:00:00.000Z"),
        trailheads=[dict(id=th_id, trail_id=trail_id, name=s_name,
                         location={"lat": s_lat, "lon": s_lon}, is_primary=True)],
        parkingLots=parking_rows,
        transitStops=stop_rows,
        closures=[],
        pois=poi_rows,
    )
    print(f"  {slug:16} {dist/1000:5.1f} km  +{up:4d} m  {duration//60}h{duration%60:02d}  "
          f"{detail['trail']['difficulty']:8} P{len(parking_rows)} T{len(stop_rows)} POI{len(poi_rows)}")
    return detail


def sql_str(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def pt(loc):
    return f"st_geogfromtext('POINT({loc['lon']} {loc['lat']})')"


def write_seed(details, today):
    out = [f"-- GENERATED by scripts/build_trails.py on {today}. Do not edit by hand; edit the script.",
           "-- Trail geometry: BRouter (hiking-mountain) over OpenStreetMap. Parking, transit stops, POIs:",
           "-- OpenStreetMap contributors (ODbL). No closures: add those by hand with a real source_url.",
           "",
           "begin;",
           "delete from transit_stop; delete from poi; delete from closure; delete from parking_lot;",
           "delete from trailhead; delete from trail;", ""]
    for d in details:
        t = d["trail"]
        b = t["bbox"]
        poly = (f"st_geogfromtext('POLYGON(({b['sw']['lon']} {b['sw']['lat']}, {b['ne']['lon']} {b['sw']['lat']}, "
                f"{b['ne']['lon']} {b['ne']['lat']}, {b['sw']['lon']} {b['ne']['lat']}, {b['sw']['lon']} {b['sw']['lat']}))')")
        out.append("insert into trail (id, name, slug, description, distance_m, ascent_m, difficulty, duration_min, family_friendly, gpx_path, bbox) values ("
                   + ", ".join(sql_str(x) for x in (t["id"], t["name"], t["slug"], t["description"], t["distance_m"],
                                                     t["ascent_m"], t["difficulty"], t["duration_min"], t["family_friendly"], t["gpx_path"]))
                   + f", {poly});")
        for th in d["trailheads"]:
            out.append(f"insert into trailhead (id, trail_id, name, location, is_primary) values ({sql_str(th['id'])}, {sql_str(th['trail_id'])}, {sql_str(th['name'])}, {pt(th['location'])}, true);")
        for p in d["parkingLots"]:
            out.append(f"insert into parking_lot (id, trailhead_id, name, location, surface_type, note, verified_on) values ({sql_str(p['id'])}, {sql_str(p['trailhead_id'])}, {sql_str(p['name'])}, {pt(p['location'])}, {sql_str(p['surface_type'])}, {sql_str(p['note'])}, {sql_str(p['verified_on'])});")
        for s in d["transitStops"]:
            out.append(f"insert into transit_stop (id, trailhead_id, name, mode, location, distance_m) values ({sql_str(s['id'])}, {sql_str(s['trailhead_id'])}, {sql_str(s['name'])}, {sql_str(s['mode'])}, {pt(s['location'])}, {s['distance_m']});")
        for p in d["pois"]:
            out.append(f"insert into poi (id, trail_id, kind, name, location, note) values ({sql_str(p['id'])}, {sql_str(p['trail_id'])}, {sql_str(p['kind'])}, {sql_str(p['name'])}, {pt(p['location'])}, null);")
        out.append("")
    out.append("commit;")
    (ROOT / "supabase" / "seed.sql").write_text("\n".join(out) + "\n")


def main():
    today = dt.date.today().isoformat()
    print("Building trails:")
    details = [build_one(cfg, today) for cfg in TRAILS]
    write_seed(details, today)
    (ROOT / "data" / "fixtures" / "trails.json").write_text(json.dumps(details, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(details)} trails -> supabase/seed.sql, data/fixtures/trails.json, public/gpx/")


if __name__ == "__main__":
    main()
