import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { atDayMinute, planDay } from "@/lib/dayPlan";
import { dayChips, dayFit, isoDate } from "@/lib/days";
import { formatTime } from "@/lib/format";
import { defaultDeparture } from "@/lib/tripSettings";
import { betterDay, shiftDays } from "@/lib/weather";
import type { WeatherForecast } from "@/lib/weather";
import { clock, wallClock, zonedDate } from "@/lib/zoned";

const RYSY = { lat: 49.1795, lon: 20.0881 };

describe("Slovak wall clock", () => {
  it("builds instants in Slovak time, summer and winter", () => {
    expect(zonedDate(2026, 7, 1, 8, 0).toISOString()).toBe("2026-07-01T06:00:00.000Z");
    expect(zonedDate(2026, 12, 1, 8, 0).toISOString()).toBe("2026-12-01T07:00:00.000Z");
    // Day and minutes overflow like Date's constructor.
    expect(zonedDate(2026, 10, 31, 0, 24 * 60 + 30).toISOString()).toBe("2026-10-31T23:30:00.000Z");
  });

  it("handles the clock-change nights", () => {
    // 25 Oct 2026: 01:30 is still summer time, 03:30 already winter time; 02:30 happens twice, the first wins.
    expect(zonedDate(2026, 10, 25, 1, 30).toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(zonedDate(2026, 10, 25, 2, 30).toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(zonedDate(2026, 10, 25, 3, 30).toISOString()).toBe("2026-10-25T02:30:00.000Z");
    // 28 Mar 2027: 02:30 doesn't exist and lands an hour later.
    expect(zonedDate(2027, 3, 28, 1, 30).toISOString()).toBe("2027-03-28T00:30:00.000Z");
    expect(clock(zonedDate(2027, 3, 28, 2, 30))).toBe("03:30");
    expect(zonedDate(2027, 3, 28, 3, 30).toISOString()).toBe("2027-03-28T01:30:00.000Z");
  });

  it("reads instants back as Slovak time", () => {
    expect(wallClock(new Date("2026-10-24T22:30:00Z"))).toMatchObject({ y: 2026, mo: 10, d: 25, h: 0, mi: 30 });
    expect(clock(new Date("2026-06-21T03:05:00Z"))).toBe("05:05");
  });
});

// The same answers on a phone set to another timezone: the trip is in Slovakia.
for (const tz of ["America/New_York", "Asia/Bangkok", "Europe/London"]) {
  describe(`on a device in ${tz}`, () => {
    let saved: string | undefined;
    beforeAll(() => {
      saved = process.env.TZ;
      process.env.TZ = tz;
    });
    afterAll(() => {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    });

    it("plans the day in Slovak time", () => {
      const plan = planDay({ date: "2026-10-24", start: "08:00", driveMin: 60, hikeMin: 7 * 60, location: RYSY })!;
      expect(formatTime(plan.segments[0].start)).toBe("08:00");
      expect(formatTime(plan.hikeEnd)).toBe("16:00");
      expect(formatTime(plan.sunset)).toBe("17:32");
      expect(plan.verdict).toBe("ok");
      expect(plan.marginMin).toBe(93);
    });

    it("keeps train minutes on the Slovak clock", () => {
      expect(formatTime(atDayMinute("2026-10-25", 8 * 60 + 15))).toBe("08:15");
    });

    it("judges the day's fit and the day chips in Slovak time", () => {
      const fit = dayFit({ date: "2026-10-24", now: new Date("2026-10-23T10:00:00Z"), driveMin: 60, hikeMin: 420, location: RYSY })!;
      expect(fit.status).toBe("fits");
      expect(formatTime(fit.latest)).toBe("09:00");
      // 23:30 UTC on Friday is already Saturday in Bratislava.
      const now = new Date("2026-10-23T23:30:00Z");
      expect(isoDate(now)).toBe("2026-10-24");
      expect(dayChips(now).map((c) => c.iso)).toEqual(["2026-10-24", "2026-10-25"]);
    });

    it("defaults the departure from the Slovak clock", () => {
      expect(defaultDeparture(new Date("2026-10-23T07:50:00Z"))).toEqual({ date: "2026-10-23", time: "10:00" });
      expect(defaultDeparture(new Date("2026-10-23T14:00:00Z"))).toEqual({ date: "2026-10-24", time: "08:00" });
    });

    it("shifts days on the Slovak clock across the clock change", () => {
      expect(formatTime(shiftDays(zonedDate(2026, 10, 24, 12, 30), 1))).toBe("12:30");
    });
  });
}

describe("drier day", () => {
  // Rain all Saturday, dry from Sunday on: hourly steps from Sat 00:00 to Mon 24:00 (Slovak time).
  const steps: WeatherForecast["steps"] = [];
  for (let t = zonedDate(2026, 10, 24).getTime(); t < zonedDate(2026, 10, 27).getTime(); t += 3600000) {
    const wet = t < zonedDate(2026, 10, 25).getTime();
    steps.push({ t: new Date(t).toISOString(), temp: 8, wind: 2, rain: wet ? 1 : 0, hours: 1, symbol: wet ? "rain" : "clearsky_day" });
  }
  const forecast: WeatherForecast = { updated: "", steps };
  const from = zonedDate(2026, 10, 24, 12, 30);
  const to = zonedDate(2026, 10, 24, 16, 55);
  const now = zonedDate(2026, 10, 23, 9, 0);

  it("suggests the next dry day", () => {
    expect(betterDay(forecast, null, from, to, now)?.offset).toBe(1);
  });

  it("skips a day the walk no longer fits", () => {
    // Sunday's sunset is an hour earlier after the clock change: the same 16:55 end is too late.
    expect(betterDay(forecast, null, from, to, now, { fits: (_a, b) => wallClock(b).d !== 25 })?.offset).toBe(2);
  });

  it("needs the departure, not just the walk, to be ahead", () => {
    // Planned for Sunday, now Saturday 11:00: Saturday's walk at 12:30 is ahead, but the 2 h drive left at 10:30.
    const sunFrom = zonedDate(2026, 10, 25, 12, 30);
    const sunTo = zonedDate(2026, 10, 25, 16, 0);
    const wetSunday: WeatherForecast = {
      updated: "",
      steps: steps.map((s) => ({ ...s, rain: s.rain ? 0 : 1, symbol: s.rain ? "clearsky_day" : "rain" })),
    };
    const sat11 = zonedDate(2026, 10, 24, 11, 0);
    expect(betterDay(wetSunday, null, sunFrom, sunTo, sat11)?.offset).toBe(-1);
    expect(betterDay(wetSunday, null, sunFrom, sunTo, sat11, { leadMin: 120 })).toBeNull();
  });
});
