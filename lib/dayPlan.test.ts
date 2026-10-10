import { describe, expect, it } from "vitest";
import { planDay, TIGHT_MARGIN_MIN } from "./dayPlan";

const BRATISLAVA = { lat: 48.1486, lon: 17.1077 };
const MIN = 60000;

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

describe("planDay", () => {
  it("lays out drive there, hike, drive back back-to-back", () => {
    const p = planDay({ date: "2026-06-21", start: "08:00", driveMin: 45, hikeMin: 180, location: BRATISLAVA })!;
    expect(p.segments.map((s) => s.kind)).toEqual(["drive-there", "hike", "drive-back"]);
    expect(hhmm(p.segments[0].start)).toBe("08:00");
    expect(hhmm(p.hikeStart)).toBe("08:45");
    expect(hhmm(p.hikeEnd)).toBe("11:45");
    expect(hhmm(p.segments[2].end)).toBe("12:30");
    expect(p.verdict).toBe("ok");
  });

  it("without a known drive, the start time is the hike start and there is only one segment", () => {
    const p = planDay({ date: "2026-06-21", start: "09:00", driveMin: null, hikeMin: 120, location: BRATISLAVA })!;
    expect(p.segments.map((s) => s.kind)).toEqual(["hike"]);
    expect(hhmm(p.hikeStart)).toBe("09:00");
  });

  it("latest start ends the hike exactly at sunset (drive back is allowed in the dark)", () => {
    const input = { date: "2026-12-21", start: "09:00", driveMin: 60, hikeMin: 240, location: BRATISLAVA };
    const p = planDay(input)!;
    expect(p.latestStart.getTime() + (60 + 240) * MIN).toBe(p.sunset.getTime());

    // Starting a minute after latestStart finishes the hike after sunset.
    const late = new Date(p.latestStart.getTime() + 1 * MIN);
    const q = planDay({ ...input, start: hhmm(late) })!;
    expect(q.marginMin).toBeLessThan(0);
    expect(["after-sunset", "after-dusk"]).toContain(q.verdict);
  });

  it("grades the finish: ok, tight, after sunset, after dusk", () => {
    const base = { date: "2026-10-10", driveMin: 0, hikeMin: 60, location: BRATISLAVA };
    const ref = planDay({ ...base, start: "09:00" })!;
    const startAt = (minutesBeforeSunset: number) =>
      hhmm(new Date(ref.sunset.getTime() - (60 + minutesBeforeSunset) * MIN));

    expect(planDay({ ...base, start: startAt(TIGHT_MARGIN_MIN + 10) })!.verdict).toBe("ok");
    expect(planDay({ ...base, start: startAt(10) })!.verdict).toBe("tight");
    expect(planDay({ ...base, start: startAt(-5) })!.verdict).toBe("after-sunset");
    expect(planDay({ ...base, start: startAt(-90) })!.verdict).toBe("after-dusk");
  });

  it("civil dusk comes 25-50 min after sunset in Slovakia", () => {
    for (const date of ["2026-03-20", "2026-06-21", "2026-12-21"]) {
      const p = planDay({ date, start: "09:00", driveMin: 0, hikeMin: 60, location: BRATISLAVA })!;
      const gap = (p.dusk.getTime() - p.sunset.getTime()) / MIN;
      expect(gap).toBeGreaterThan(25);
      expect(gap).toBeLessThan(50);
    }
  });

  it("flags a hike that starts before sunrise", () => {
    const p = planDay({ date: "2026-12-21", start: "05:30", driveMin: 30, hikeMin: 120, location: BRATISLAVA })!;
    expect(p.startsInDark).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(planDay({ date: "", start: "09:00", driveMin: 0, hikeMin: 60, location: BRATISLAVA })).toBeNull();
    expect(planDay({ date: "2026-06-21", start: "", driveMin: 0, hikeMin: 60, location: BRATISLAVA })).toBeNull();
  });
});
