"""Trip data as SQL for the Cloudflare D1 database behind /api/vylety.

Reads what the weekly build writes (data/trips, data/drive-times.json,
data/closure-rules.json) and prints one SQL file that drops and refills the
trip tables. The visit counter's tables in the same database are not touched.
The schema follows strategy/12-research/db/01_schema.sql, trimmed to what the
site serves (no users or partners yet) plus the walk geometry per trip.

    python -m pipeline.db > build/db.sql
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Child tables first, so DROP never trips over a foreign key.
TABLES = [
    "data_version", "drive_time", "town", "trip_fee", "fee", "trip_closure", "closure_rule",
    "poi", "trip_transit_stop", "transit_stop", "parking", "trip", "place", "protected_area", "region",
]

SCHEMA = """
CREATE TABLE region (
  id    INTEGER PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL
);
CREATE TABLE protected_area (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);
CREATE TABLE place (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('start','vrchol','vyhliadka','hrad','chata','pleso','vodopad','jaskyna','ine')),
  lat      REAL NOT NULL CHECK (lat BETWEEN 47.7 AND 49.7),
  lon      REAL NOT NULL CHECK (lon BETWEEN 16.8 AND 22.6),
  ele_m    INTEGER,
  osm_ref  TEXT
);
CREATE TABLE trip (
  id                 INTEGER PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  region_id          INTEGER NOT NULL REFERENCES region(id),
  protected_area_id  INTEGER REFERENCES protected_area(id),
  destination_id     INTEGER NOT NULL REFERENCES place(id),
  start_id           INTEGER NOT NULL REFERENCES place(id),
  route_type         TEXT NOT NULL CHECK (route_type IN ('tam-a-spat','okruh')),
  distance_m         INTEGER NOT NULL CHECK (distance_m > 0),
  ascent_m           INTEGER NOT NULL CHECK (ascent_m >= 0),
  duration_min       INTEGER NOT NULL CHECK (duration_min > 0),
  max_ele_m          INTEGER,
  difficulty         TEXT NOT NULL CHECK (difficulty IN ('lahka','stredna','tazka')),
  family_friendly    INTEGER NOT NULL CHECK (family_friendly IN (0,1)),
  marked_share       REAL NOT NULL CHECK (marked_share BETWEEN 0 AND 1),
  rank               INTEGER NOT NULL CHECK (rank BETWEEN 0 AND 100),
  curated            INTEGER NOT NULL CHECK (curated IN (0,1)),
  gpx_url            TEXT NOT NULL,
  -- KST colours along the walk, e.g. ["red","green"]
  marking_json       TEXT NOT NULL,
  bbox_json          TEXT NOT NULL,
  -- The walk itself: [[lon, lat, ele], ...], where it turns back, and its colour runs
  path_json          TEXT,
  turnaround_index   INTEGER,
  marking_runs_json  TEXT,
  CHECK (start_id <> destination_id)
);
CREATE TABLE parking (
  id         INTEGER PRIMARY KEY,
  trip_id    INTEGER NOT NULL REFERENCES trip(id),
  name       TEXT,
  lat        REAL NOT NULL,
  lon        REAL NOT NULL,
  walk_m     INTEGER NOT NULL CHECK (walk_m >= 0),
  fee_paid   INTEGER CHECK (fee_paid IN (0,1)),
  is_primary INTEGER NOT NULL CHECK (is_primary IN (0,1)),
  osm_ref    TEXT
);
CREATE TABLE transit_stop (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  mode     TEXT NOT NULL CHECK (mode IN ('autobus','elektricka','vlak')),
  lat      REAL NOT NULL,
  lon      REAL NOT NULL,
  osm_ref  TEXT UNIQUE
);
CREATE TABLE trip_transit_stop (
  trip_id     INTEGER NOT NULL REFERENCES trip(id),
  stop_id     INTEGER NOT NULL REFERENCES transit_stop(id),
  walk_m      INTEGER NOT NULL CHECK (walk_m >= 0),
  is_primary  INTEGER NOT NULL CHECK (is_primary IN (0,1)),
  position    INTEGER NOT NULL,
  PRIMARY KEY (trip_id, stop_id)
);
CREATE TABLE poi (
  id        INTEGER PRIMARY KEY,
  trip_id   INTEGER NOT NULL REFERENCES trip(id),
  kind      TEXT NOT NULL CHECK (kind IN ('vyhliadka','chata','obcerstvenie','pramen','hrad','ihrisko','utulna')),
  name      TEXT NOT NULL,
  lat       REAL NOT NULL,
  lon       REAL NOT NULL,
  osm_ref   TEXT,
  position  INTEGER NOT NULL
);
CREATE TABLE closure_rule (
  id           TEXT PRIMARY KEY,
  reason       TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('rocna','jednorazova')),
  starts_on    TEXT NOT NULL,
  ends_on      TEXT NOT NULL,
  source_url   TEXT NOT NULL CHECK (source_url LIKE 'https://%'),
  verified_on  TEXT NOT NULL,
  applies_to   TEXT,
  CHECK (ends_on >= starts_on)
);
CREATE TABLE trip_closure (
  trip_id  INTEGER NOT NULL REFERENCES trip(id),
  rule_id  TEXT NOT NULL REFERENCES closure_rule(id),
  PRIMARY KEY (trip_id, rule_id)
);
CREATE TABLE fee (
  id           INTEGER PRIMARY KEY,
  kind         TEXT NOT NULL,
  text         TEXT NOT NULL,
  amount_eur   REAL CHECK (amount_eur IS NULL OR amount_eur >= 0),
  source       TEXT NOT NULL CHECK (source IN ('osm','rule')),
  source_url   TEXT,
  rule_id      TEXT,
  UNIQUE (text, source_url)
);
CREATE TABLE trip_fee (
  trip_id  INTEGER NOT NULL REFERENCES trip(id),
  fee_id   INTEGER NOT NULL REFERENCES fee(id),
  PRIMARY KEY (trip_id, fee_id)
);
CREATE TABLE town (
  id    INTEGER PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL,
  lat   REAL NOT NULL,
  lon   REAL NOT NULL
);
CREATE TABLE drive_time (
  town_id  INTEGER NOT NULL REFERENCES town(id),
  trip_id  INTEGER NOT NULL REFERENCES trip(id),
  minutes  INTEGER NOT NULL CHECK (minutes >= 0),
  km       REAL NOT NULL CHECK (km >= 0),
  PRIMARY KEY (town_id, trip_id)
) WITHOUT ROWID;
CREATE INDEX trip_region_idx ON trip (region_id);
CREATE INDEX parking_trip_idx ON parking (trip_id);
CREATE INDEX poi_trip_idx ON poi (trip_id);
CREATE INDEX drive_time_trip_idx ON drive_time (trip_id);
-- One row: which weekly build is loaded. Written last, so a reader that finds
-- it knows every other table is complete.
CREATE TABLE data_version (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  generated_at  TEXT NOT NULL,
  osm_data_at   TEXT,
  trips         INTEGER NOT NULL,
  fingerprint   TEXT NOT NULL
);
"""

# D1 caps one SQL statement at 100 KB; at 80 KB the local D1 (wrangler --local)
# already runs out of memory, so INSERTs are cut at 40 KB.
MAX_STATEMENT_BYTES = 40_000


def q(v):
    """A Python value as an SQL literal."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (list, dict)):
        v = json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    return "'" + str(v).replace("'", "''") + "'"


def inserts(table, columns, rows):
    head = f"INSERT INTO {table} ({','.join(columns)}) VALUES\n"
    out, batch, size = [], [], len(head)
    for r in rows:
        value = "(" + ",".join(q(v) for v in r) + ")"
        n = len(value.encode()) + 2
        if batch and size + n > MAX_STATEMENT_BYTES:
            out.append(head + ",\n".join(batch) + ";")
            batch, size = [], len(head)
        batch.append(value)
        size += n
    if batch:
        out.append(head + ",\n".join(batch) + ";")
    return out


def build_sql(root=ROOT):
    index = json.loads((root / "data" / "trips" / "index.json").read_text())
    drive = json.loads((root / "data" / "drive-times.json").read_text())
    closures = json.loads((root / "data" / "closure-rules.json").read_text())["rules"]

    regions, areas, places, trips = {}, {}, [], []
    parkings, stops, trip_stops, pois, trip_closures, fees, trip_fees = [], {}, [], [], [], {}, []

    def place(p, kind):
        places.append((len(places) + 1, p["name"] or "", kind, p["location"]["lat"], p["location"]["lon"], p.get("ele_m"), p.get("osm")))
        return len(places)

    for tid, summary in enumerate(index["trips"], start=1):
        detail = json.loads((root / "data" / "trips" / f"{summary['slug']}.json").read_text())
        rid = regions.setdefault(summary["region"], (len(regions) + 1, summary["region_name"]))[0]
        aid = None
        if summary.get("protected_area"):
            aid = areas.setdefault(summary["protected_area"], len(areas) + 1)
        dest = place(summary["destination"], summary["destination"]["kind"])
        start = place(summary["start"], "start")
        trips.append((
            tid, summary["slug"], summary["name"], summary["description"], rid, aid, dest, start,
            summary["route"], summary["distance_m"], summary["ascent_m"], summary["duration_min"],
            summary.get("max_ele_m"), summary["difficulty"], summary["family_friendly"],
            summary["marked_share"], summary["rank"], summary["curated"], summary["gpx_url"],
            summary["marking"], summary["bbox"],
            detail.get("path"), detail.get("turnaround_index"), detail.get("marking_runs"),
        ))
        for i, p in enumerate([summary["parking"], *detail.get("parking_alternatives", [])]):
            if p is None:
                continue
            parkings.append((len(parkings) + 1, tid, p.get("name"), p["location"]["lat"], p["location"]["lon"],
                             p["walk_m"], p.get("fee"), i == 0, p.get("osm")))
        seen = set()
        for i, s in enumerate([summary["transit"], *detail.get("transit_alternatives", [])]):
            if s is None:
                continue
            key = s.get("osm") or f"{s['name']}@{s['location']['lat']},{s['location']['lon']}"
            sid = stops.setdefault(key, (len(stops) + 1, s["name"], s["mode"], s["location"]["lat"], s["location"]["lon"], s.get("osm")))[0]
            if sid in seen:
                continue
            seen.add(sid)
            trip_stops.append((tid, sid, s["walk_m"], i == 0, i))
        for i, p in enumerate(detail.get("pois", [])):
            pois.append((len(pois) + 1, tid, p["kind"], p["name"], p["location"]["lat"], p["location"]["lon"], p.get("osm"), i))
        for rule in summary["closure_rule_ids"]:
            trip_closures.append((tid, rule))
        for f in summary["fees"]:
            fid = fees.setdefault((f["text"], f.get("source_url")), (
                len(fees) + 1, f["kind"], f["text"], f.get("amount_eur"), f["source"], f.get("source_url"), f.get("rule_id")))[0]
            trip_fees.append((tid, fid))

    slug_to_id = {t[1]: t[0] for t in trips}
    towns = [(i, t["id"], t["name"], t["location"]["lat"], t["location"]["lon"]) for i, t in enumerate(drive["towns"], start=1)]
    drive_rows = []
    for town_i, (minutes, km) in enumerate(zip(drive["minutes"], drive["km"])):
        for slug, m, k in zip(drive["slugs"], minutes, km):
            if m is not None and k is not None and slug in slug_to_id:
                drive_rows.append((town_i + 1, slug_to_id[slug], m, k))

    sql = [f"DROP TABLE IF EXISTS {t};" for t in TABLES]
    sql.append(SCHEMA.strip())
    sql += inserts("region", ["id", "slug", "name"], [(i, s, n) for s, (i, n) in regions.items()])
    sql += inserts("protected_area", ["id", "name"], [(i, n) for n, i in areas.items()])
    sql += inserts("place", ["id", "name", "kind", "lat", "lon", "ele_m", "osm_ref"], places)
    sql += inserts("trip", [
        "id", "slug", "name", "description", "region_id", "protected_area_id", "destination_id", "start_id",
        "route_type", "distance_m", "ascent_m", "duration_min", "max_ele_m", "difficulty", "family_friendly",
        "marked_share", "rank", "curated", "gpx_url", "marking_json", "bbox_json",
        "path_json", "turnaround_index", "marking_runs_json"], trips)
    sql += inserts("parking", ["id", "trip_id", "name", "lat", "lon", "walk_m", "fee_paid", "is_primary", "osm_ref"], parkings)
    sql += inserts("transit_stop", ["id", "name", "mode", "lat", "lon", "osm_ref"], list(stops.values()))
    sql += inserts("trip_transit_stop", ["trip_id", "stop_id", "walk_m", "is_primary", "position"], trip_stops)
    sql += inserts("poi", ["id", "trip_id", "kind", "name", "lat", "lon", "osm_ref", "position"], pois)
    sql += inserts("closure_rule", ["id", "reason", "kind", "starts_on", "ends_on", "source_url", "verified_on", "applies_to"],
                   [(r["id"], r["reason"], r["kind"], r["starts_on"], r["ends_on"], r["source_url"], r["verified_on"], r.get("applies_to")) for r in closures])
    sql += inserts("trip_closure", ["trip_id", "rule_id"], trip_closures)
    sql += inserts("fee", ["id", "kind", "text", "amount_eur", "source", "source_url", "rule_id"], list(fees.values()))
    sql += inserts("trip_fee", ["trip_id", "fee_id"], trip_fees)
    sql += inserts("town", ["id", "slug", "name", "lat", "lon"], towns)
    sql += inserts("drive_time", ["town_id", "trip_id", "minutes", "km"], drive_rows)
    body = "\n".join(sql) + "\n"
    sql += inserts("data_version", ["id", "generated_at", "osm_data_at", "trips", "fingerprint"],
                   [(1, index["generated_at"], index.get("osm_data_at"), len(trips), fingerprint(body))])
    return "\n".join(sql) + "\n"


def fingerprint(sql):
    """Short hash of everything but the version row: same data, same fingerprint.
    The loader skips a load the database already holds (D1 free: 100k rows written a day)."""
    return hashlib.sha256(sql.encode()).hexdigest()[:16]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, help="write here instead of stdout")
    ap.add_argument("--fingerprint", action="store_true", help="print only the data fingerprint")
    args = ap.parse_args(argv)
    sql = build_sql()
    if args.fingerprint:
        print(fingerprint(sql.rsplit("INSERT INTO data_version", 1)[0]))
        return
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(sql)
    else:
        sys.stdout.write(sql)


if __name__ == "__main__":
    main()
