"""Monthly usage report: Umami events + the D1 visit counter, for one month.

Run by .github/workflows/report.yml on the 1st of every month (for the month
before) or by hand. Reads only; writes build/report/<month>.json and .md, and
prints the JSON on one log line starting with REPORT_JSON so it can be picked
up from the run's log.

Umami needs the UMAMI_API_KEY secret (Umami Cloud > Settings > API keys).
Without it the report still has the D1 numbers and says what is missing.

The D1 part is also the backup of the only data in D1 that can't be rebuilt
from this repository: the visit totals. Trips and trails are rebuilt by the
"Trip database" workflow from data/ at any time.
"""

from __future__ import annotations

import argparse
import calendar
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

UMAMI_API = "https://api.umami.is/v1"
# Product events (lib/analytics.ts), in the order the report lists them.
EVENTS = [
    "start_set",
    "trip_open",
    "trip_saved",
    "share",
    "share_sent",
    "shared_open",
    "nav_open",
    "transit_open",
    "gpx_download",
    "tester_signup_open",
]
# Events that carry "took" (time since the visitor landed).
TIMED = ["trip_saved", "share_sent"]


def previous_month(today: date) -> str:
    y, m = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
    return f"{y:04d}-{m:02d}"


def month_range_ms(month: str) -> tuple[int, int]:
    y, m = (int(p) for p in month.split("-"))
    start = datetime(y, m, 1, tzinfo=timezone.utc)
    last = calendar.monthrange(y, m)[1]
    end = datetime(y, m, last, 23, 59, 59, 999000, tzinfo=timezone.utc)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000)


def umami_get(key: str, path: str, params: dict) -> object:
    url = f"{UMAMI_API}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def number(v: object) -> int:
    """Umami's stats come as 12 or {"value": 12, ...} depending on the version."""
    if isinstance(v, dict):
        v = v.get("value", 0)
    return int(v or 0)


def umami_numbers(key: str, website: str, month: str) -> dict:
    start, end = month_range_ms(month)
    span = {"startAt": start, "endAt": end}
    stats = umami_get(key, f"/websites/{website}/stats", span)
    out: dict = {k: number(stats.get(k)) for k in ("pageviews", "visitors", "visits")}

    rows = umami_get(key, f"/websites/{website}/metrics", {**span, "type": "event", "limit": 100})
    counts = {r.get("x"): int(r.get("y", 0)) for r in rows}
    out["events"] = {name: counts.get(name, 0) for name in EVENTS}

    took: dict = {}
    for name in TIMED:
        try:
            values = umami_get(
                key,
                f"/websites/{website}/event-data/values",
                {**span, "event": name, "eventName": name, "propertyName": "took"},
            )
            took[name] = {str(v.get("value")): int(v.get("total", 0)) for v in values}
        except Exception as err:  # noqa: BLE001 - one missing breakdown must not lose the report
            took[name] = {"error": str(err)}
    out["took"] = took

    try:
        refs = umami_get(key, f"/websites/{website}/metrics", {**span, "type": "referrer", "limit": 5})
        out["top_referrers"] = [{"from": r.get("x") or "(direct)", "visits": int(r.get("y", 0))} for r in refs]
    except Exception as err:  # noqa: BLE001
        out["top_referrers"] = {"error": str(err)}
    return out


def ratio(a: int, b: int) -> float | None:
    return round(a / b, 3) if b else None


def kpis(umami: dict | None) -> dict:
    """The goals in digi-entre/17-data-and-dashboards.md."""
    if not umami:
        return {}
    ev = umami["events"]
    sent_fast = umami["took"].get("share_sent", {}).get("0-2 min", 0)
    return {
        # Confirmed plans (north star, goal 20/month): saved + sent + navigation started.
        "confirmed_plans": ev["trip_saved"] + ev["share_sent"] + ev["nav_open"],
        # Visits where a start was known (goal 50 %). start_set is sent once per page load,
        # so a visit with a reload counts twice: slightly high.
        "activation": ratio(ev["start_set"], umami["visits"]),
        # Shares sent within two minutes of landing (goal 50 %).
        "two_minute_share": ratio(sent_fast, ev["share_sent"]),
        # Friends who opened a shared plan per plan sent (goal >= 1.5).
        "growth_loop": ratio(ev["shared_open"], ev["share_sent"]),
    }


def markdown(report: dict) -> str:
    m = report["month"]
    lines = [f"# MounTour usage, {m}", ""]
    u = report.get("umami")
    if u:
        k = report["kpis"]

        def pct(v: float | None) -> str:
            return "n/a" if v is None else f"{round(v * 100)} %"

        lines += [
            "| Goal | This month | Target |",
            "| --- | --- | --- |",
            f"| Confirmed plans | {k['confirmed_plans']} | 20 |",
            f"| Activation (start known) | {pct(k['activation'])} | 50 % |",
            f"| Two-minute share | {pct(k['two_minute_share'])} | 50 % |",
            f"| Growth loop (opens per share) | {k['growth_loop'] if k['growth_loop'] is not None else 'n/a'} | 1.5 |",
            "",
            f"Visitors {u['visitors']}, visits {u['visits']}, page views {u['pageviews']}.",
            "",
            "| Event | Count |",
            "| --- | --- |",
        ]
        lines += [f"| {name} | {n} |" for name, n in u["events"].items()]
    else:
        lines += [f"Umami: {report.get('umami_error', 'not read')}. Copy the numbers from the Umami dashboard by hand.", ""]

    lines += ["", "## Visit counter (/statistiky)", "", "| Month | People | 2+ days | 4+ days | Avg days |", "| --- | --- | --- | --- | --- |"]
    for r in report.get("visits", []):
        lines.append(
            f"| {r['month']} | {r['visitors']} | {r['visitors_2plus_days']} | {r['visitors_4plus_days']} | {r['avg_days']} |"
        )
    if report.get("visits_error"):
        lines.append(f"\nVisit counter not read: {report['visits_error']}")
    return "\n".join(lines) + "\n"


def read_visits(path: str | None) -> tuple[list, str | None]:
    """wrangler d1 execute --json output: a list with one result set per statement."""
    if not path or not Path(path).exists():
        return [], "no D1 export"
    try:
        sets = json.loads(Path(path).read_text())
        rows: list = []
        for s in sets:
            rows += s.get("results", [])
        # Finished months come from visit_month; the running month from the raw rows.
        by_month = {r["month"]: r for r in rows if r.get("month")}
        return [by_month[k] for k in sorted(by_month)], None
    except Exception as err:  # noqa: BLE001
        return [], str(err)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--month", default="", help="YYYY-MM; default the month before today")
    ap.add_argument("--visits", help="JSON from wrangler d1 execute --json")
    ap.add_argument("--out", default="build/report")
    args = ap.parse_args()

    month = args.month or previous_month(datetime.now(timezone.utc).date())
    report: dict = {"month": month, "made_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}

    key = os.environ.get("UMAMI_API_KEY", "")
    website = os.environ.get("UMAMI_WEBSITE_ID", "")
    if key and website:
        try:
            report["umami"] = umami_numbers(key, website, month)
        except Exception as err:  # noqa: BLE001
            report["umami_error"] = f"API call failed ({err})"
    else:
        report["umami_error"] = "no UMAMI_API_KEY secret"
    report["kpis"] = kpis(report.get("umami"))

    report["visits"], err = read_visits(args.visits)
    if err:
        report["visits_error"] = err

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{month}.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    md = markdown(report)
    (out / f"{month}.md").write_text(md)

    print("REPORT_JSON " + json.dumps(report, ensure_ascii=False))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
