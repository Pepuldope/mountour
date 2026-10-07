import { describe, expect, it } from "vitest";
import { getSunTimes } from "./sun";

// Bratislava
const LAT = 48.1486;
const LON = 17.1077;

function utcToLocalMinutes(date: Date, utcOffsetHours: number): number {
  const totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + utcOffsetHours * 60;
  return ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
}

function minutesFromHHMM(hh: number, mm: number): number {
  return hh * 60 + mm;
}

describe("getSunTimes", () => {
  it("matches known Bratislava sunset on 21 Dec (~16:01 CET, UTC+1)", () => {
    const date = new Date(Date.UTC(2025, 11, 21));
    const sun = getSunTimes(date, LAT, LON);
    expect(sun).not.toBeNull();
    const localMinutes = utcToLocalMinutes(sun!.sunset, 1);
    const expected = minutesFromHHMM(16, 1);
    expect(Math.abs(localMinutes - expected)).toBeLessThanOrEqual(10);
  });

  it("matches known Bratislava sunset on 21 Jun (~21:00 CEST, UTC+2)", () => {
    const date = new Date(Date.UTC(2026, 5, 21));
    const sun = getSunTimes(date, LAT, LON);
    expect(sun).not.toBeNull();
    const localMinutes = utcToLocalMinutes(sun!.sunset, 2);
    const expected = minutesFromHHMM(21, 0);
    expect(Math.abs(localMinutes - expected)).toBeLessThanOrEqual(10);
  });

  it("sunrise is before sunset on the same day", () => {
    const date = new Date(Date.UTC(2026, 2, 15));
    const sun = getSunTimes(date, LAT, LON);
    expect(sun).not.toBeNull();
    expect(sun!.sunrise.getTime()).toBeLessThan(sun!.sunset.getTime());
  });
});
