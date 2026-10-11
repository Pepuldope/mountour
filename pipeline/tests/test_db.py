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
    sql = db.build_sql()
    body, version = sql.rsplit("INSERT INTO data_version", 1)
    assert db.fingerprint(body) in version
    assert db.fingerprint(body + "-- changed\n") != db.fingerprint(body)
