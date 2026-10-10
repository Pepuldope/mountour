import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { closureRulesFor, driveMinutes, getAllTrips, getClosureRules, getDriveTimes, getTrip } from "@/lib/trips";
import { isClosureActive } from "@/lib/closures";

// Checks the static trip files the pipeline writes (docs/TRIP-DATA.md).
describe("trip data", () => {
  const trips = getAllTrips();

  it("has unique slugs, a detail file and a GPX file for every trip", async () => {
    expect(new Set(trips.map((t) => t.slug)).size).toBe(trips.length);
    for (const t of trips) {
      const d = await getTrip(t.slug);
      expect(d?.slug).toBe(t.slug);
      expect(d!.path.length).toBeGreaterThan(1);
      expect(existsSync(`public${t.gpx_url}`)).toBe(true);
    }
  });

  it("keeps the 10 hand-picked trips", () => {
    expect(trips.filter((t) => t.curated).length).toBe(10);
  });

  it("only points at closure rules that exist and carry a source", () => {
    const ids = new Set(getClosureRules().map((r) => r.id));
    for (const t of trips) for (const id of t.closure_rule_ids) expect(ids.has(id)).toBe(true);
    for (const r of getClosureRules()) {
      expect(r.source_url).toMatch(/^https:\/\//);
      expect(r.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("applies the TANAP closure in winter and not in summer", () => {
    const rule = { ...getClosureRules().find((r) => r.id === "tanap-sezonna-uzavera")!, trail_id: "test" };
    expect(isClosureActive(rule, "2027-01-15")).toBe(true);
    expect(isClosureActive(rule, "2027-05-31")).toBe(true);
    expect(isClosureActive(rule, "2027-06-01")).toBe(false);
    expect(closureRulesFor({ closure_rule_ids: [] })).toEqual([]);
  });

  it("has a drive-time column per trip once the table is built", () => {
    const dt = getDriveTimes();
    if (dt.towns.length === 0) return;
    expect(dt.slugs).toEqual(trips.map((t) => t.slug));
    expect(dt.minutes.length).toBe(dt.towns.length);
    expect(driveMinutes(dt.towns[0].id, "no-such-trip")).toBeNull();
  });
});
