"""The D1 load file: valid SQLite, within D1's statement limit, refills cleanly.
(lib/tripDb.test.ts checks the site reads back exactly what data/ holds.)"""

import sqlite3

from pipeline import db

D1_MAX_STATEMENT = 50_000  # D1 allows 100 KB; see db.MAX_STATEMENT_BYTES


def test_sql_loads_twice_with_foreign_keys_and_matches_the_index():
    sql = db.build_sql()
    con = sqlite3.connect(":memory:")
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(sql)
    con.executescript(sql)  # the weekly reload drops and refills
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    trips = con.execute("SELECT trips FROM data_version").fetchone()[0]
    assert trips == con.execute("SELECT count(*) FROM trip").fetchone()[0] > 0


def test_every_statement_fits_d1():
    for statement in db.build_sql().split(";\n"):
        assert len(statement.encode()) < D1_MAX_STATEMENT


def test_fingerprint_ignores_only_the_version_row():
    rows, version = db.build_rows()
    sql = db.full_sql(rows, version)
    assert db.fingerprint(db.data_body(rows)) in sql.rsplit("INSERT INTO data_version", 1)[1]
    version["generated_at"] = "2099-01-01T00:00:00Z"
    assert db.fingerprint(db.data_body(rows)) in db.full_sql(rows, version)


def _have(con):
    """What the loader asks D1 before a load, answered by SQLite in wrangler's --json shape."""
    con.row_factory = sqlite3.Row
    out = [{"results": [dict(r) for r in con.execute(sql)]} for sql in db.HAVE_QUERIES]
    con.row_factory = None
    return db.have_from_results(out)


def _dump(con):
    return {t: sorted(con.execute(f"SELECT * FROM {t}").fetchall()) for t in db.ORDER}


def test_incremental_load_ends_where_a_full_load_would():
    rows, version = db.build_rows()
    con = sqlite3.connect(":memory:")
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(db.full_sql(rows, version))

    # Next week: one trip renamed, one gone (with all it had), a stop renamed, one town's drives changed.
    new = {t: list(r) for t, r in rows.items()}
    renamed, gone = new["trip"][0], new["trip"][-1]
    new["trip"][0] = renamed[:2] + ("Nový názov",) + renamed[3:-1] + ("changed",)
    new["trip"] = new["trip"][:-1]
    for t in db.PER_TRIP:
        new[t] = [r for r in new[t] if r[0] != gone[0]]
    new["place"] = [r for r in new["place"] if r[0] // 2 != gone[0]]
    used = {r[1] for r in new["trip_transit_stop"]}
    new["transit_stop"] = [r for r in new["transit_stop"] if r[0] in used]
    new["transit_stop"][0] = new["transit_stop"][0][:1] + ("Iná zastávka",) + new["transit_stop"][0][2:]
    new["fee"] = [r for r in new["fee"] if r[0] in {f for _, f in new["trip_fee"]}]
    new["town_drive"][0] = (new["town_drive"][0][0], "[1]", "[2]")
    version = {**version, "trips": len(new["trip"])}

    sql, written = db.incremental_sql(new, version, _have(con))
    con.executescript(sql)
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    assert written < 200

    full = sqlite3.connect(":memory:")
    full.executescript(db.full_sql(new, version))
    assert _dump(con) == _dump(full)


def test_unchanged_data_writes_only_the_version_and_a_new_schema_reloads_everything():
    rows, version = db.build_rows()
    con = sqlite3.connect(":memory:")
    con.executescript(db.full_sql(rows, version))
    have = _have(con)
    sql, written = db.incremental_sql(rows, version, have)
    assert written == 1 and "INSERT INTO trip " not in sql
    assert db.incremental_sql(rows, version, {**have, "schema_hash": "old"}) == (None, None)


def test_ids_stay_the_same_across_builds():
    a = db.stable_ids(["chleb", "krivan", "sitno"])
    b = db.stable_ids(["krivan", "novy-vylet", "chleb", "sitno"])
    assert all(a[k] == b[k] for k in a)
    assert max(b.values()) < 2**31
