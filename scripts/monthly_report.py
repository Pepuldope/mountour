"""Monthly usage report: the site's own counters in D1, for one month.

Run by .github/workflows/report.yml on the 1st of every month (for the month
before) or by hand. Reads only; writes build/report/<month>.json and .md, and
prints the JSON on one log line starting with REPORT_JSON so it can be picked
up from the run's log.

Two counters (both shown on /statistiky): people and visit days
(lib/visitStore.ts) and monthly totals of the actions behind the goals
(lib/eventCounts.ts). Umami has the same events plus sources, but its free
plan has no API, so those stay on its dashboard.

This is also the backup of the only data in D1 that can't be rebuilt from this
repository: these totals. Trips and trails are rebuilt by the "Trip database"
workflow from data/ at any time.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path


def previous_month(today: date) -> str:
    y, m = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
    return f"{y:04d}-{m:02d}"


def rows_of(path: str | None) -> tuple[list, str | None]:
    """wrangler d1 execute --json output: a list with one result set per statement."""
    if not path or not Path(path).exists():
        return [], "not read"
    try:
        rows: list = []
        for s in json.loads(Path(path).read_text()):
            rows += s.get("results", [])
        return rows, None
    except Exception as err:  # noqa: BLE001
        return [], str(err)


def event_totals(rows: list, month: str) -> dict:
    t = {"starts": 0, "saved": 0, "sent": 0, "sent_fast": 0, "friend_opens": 0, "navigations": 0, "plus_want": 0, "plus_no": 0}
    for r in rows:
        if r.get("month") != month:
            continue
        name, n = r.get("name"), int(r.get("n", 0))
        if name == "start_set":
            t["starts"] += n
        elif name == "trip_saved":
            t["saved"] += n
        elif name == "share_sent":
            t["sent"] += n
            if r.get("detail") == "0-2 min":
                t["sent_fast"] += n
        elif name == "shared_open":
            t["friend_opens"] += n
        elif name == "nav_open":
            t["navigations"] += n
        elif name in ("plus_want", "plus_no"):
            t[name] += n
    return t


def ratio(a: float, b: float) -> float | None:
    return round(a / b, 3) if b else None


def kpis(events: dict, visit: dict | None) -> dict:
    """The goals in digi-entre/17-data-and-dashboards.md."""
    # Visit days = people x average days: a page load per person per day at least.
    visit_days = round(visit["visitors"] * visit["avg_days"]) if visit else 0
    return {
        # North star, goal 20/month: plans saved, sent or taken into navigation.
        "confirmed_plans": events["saved"] + events["sent"] + events["navigations"],
        # Goal 50 %. start_set is sent once per page load and visit days count a person once a
        # day, so this runs high when people reload; read it as a trend.
        "activation": ratio(events["starts"], visit_days),
        # Goal 50 %: plans sent within two minutes of landing.
        "two_minute_share": ratio(events["sent_fast"], events["sent"]),
        # Goal >= 1.5: friends opening a shared plan per plan sent.
        "growth_loop": ratio(events["friend_opens"], events["sent"]),
    }


def markdown(report: dict) -> str:
    k, e = report["kpis"], report["events"]

    def pct(v: float | None) -> str:
        return "n/a" if v is None else f"{round(v * 100)} %"

    lines = [
        f"# MounTour usage, {report['month']}",
        "",
        "| Goal | This month | Target |",
        "| --- | --- | --- |",
        f"| Confirmed plans | {k['confirmed_plans']} | 20 |",
        f"| Activation (start known) | {pct(k['activation'])} | 50 % |",
        f"| Two-minute share | {pct(k['two_minute_share'])} | 50 % |",
        f"| Growth loop (opens per share) | {k['growth_loop'] if k['growth_loop'] is not None else 'n/a'} | 1.5 |",
        "",
        "| Action | Count |",
        "| --- | --- |",
    ]
    lines += [f"| {name} | {n} |" for name, n in e.items()]
    lines += ["", "## People (/statistiky)", "", "| Month | People | 2+ days | 4+ days | Avg days |", "| --- | --- | --- | --- | --- |"]
    for r in report["visits"]:
        lines.append(
            f"| {r['month']} | {r['visitors']} | {r['visitors_2plus_days']} | {r['visitors_4plus_days']} | {r['avg_days']} |"
        )
    for key in ("visits_error", "events_error"):
        if report.get(key):
            lines.append(f"\n{key.split('_')[0].title()} not read: {report[key]}")
    lines += ["", "Sources, pages and devices: Umami dashboard (free plan has no export)."]
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--month", default="", help="YYYY-MM; default the month before today")
    ap.add_argument("--visits", help="visit totals, JSON from wrangler d1 execute --json")
    ap.add_argument("--events", help="event_month rows, JSON from wrangler d1 execute --json")
    ap.add_argument("--out", default="build/report")
    args = ap.parse_args()

    month = args.month or previous_month(datetime.now(timezone.utc).date())
    report: dict = {"month": month, "made_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}

    visit_rows, err = rows_of(args.visits)
    if err:
        report["visits_error"] = err
    by_month = {r["month"]: r for r in visit_rows if r.get("month")}
    report["visits"] = [by_month[m] for m in sorted(by_month)]

    event_rows, err = rows_of(args.events)
    if err:
        report["events_error"] = err
    report["events"] = event_totals(event_rows, month)
    report["event_rows"] = [r for r in event_rows if r.get("month")]  # the whole table: the backup
    report["kpis"] = kpis(report["events"], by_month.get(month))

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
