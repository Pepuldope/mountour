import { describe, expect, it } from "vitest";
import { getSunTimes, sunAltitude } from "./sun";

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
  // NOAA solar calculator, Bratislava, minutes after UTC midnight. The old short equation ran up to ~2.5 min late.
  it.each([
    [2026, 0, 15, 6 * 60 + 37.1, 15 * 60 + 25.2],
    [2026, 5, 21, 2 * 60 + 51.3, 18 * 60 + 55.5],
    [2026, 9, 17, 5 * 60 + 13.7, 15 * 60 + 59.3],
    [2026, 11, 21, 6 * 60 + 39.1, 15 * 60 + 0.1],
  ])("is within a minute of NOAA on %i-%i-%i", (y, m, d, rise, set) => {
    const midnight = Date.UTC(y, m, d);
    const sun = getSunTimes(new Date(midnight), LAT, LON)!;
    expect(Math.abs((sun.sunrise.getTime() - midnight) / 60000 - rise)).toBeLessThan(1);
    expect(Math.abs((sun.sunset.getTime() - midnight) / 60000 - set)).toBeLessThan(1);
  });

  it("matches known Bratislava sunset on 21 Dec (~16:01 CET, UTC+1)", () => {
    const date = new Date(Date.UTC(2025, 11, 21));
    const sun = getSunTimes(date, LAT, LON);
    expect(sun).not.toBeNull();
    const localMinutes = utcToLocalMinutes(sun!.sunset, 1);
    const expected = minutesFromHHMM(16, 1);
    expect(Math.abs(localMinutes - expected)).toBeLessThanOrEqual(2);
  });

  it("matches known Bratislava sunset on 21 Jun (~20:55 CEST, UTC+2)", () => {
    const date = new Date(Date.UTC(2026, 5, 21));
    const sun = getSunTimes(date, LAT, LON);
    expect(sun).not.toBeNull();
    const localMinutes = utcToLocalMinutes(sun!.sunset, 2);
    const expected = minutesFromHHMM(20, 55);
    expect(Math.abs(localMinutes - expected)).toBeLessThanOrEqual(2);
  });

  it("sunrise is before sunset on the same day", () => {
    const date = new Date(Date.UTC(2026, 2, 15));
    const sun = getSunTimes(date, LAT, LON);
    expect(sun).not.toBeNull();
    expect(sun!.sunrise.getTime()).toBeLessThan(sun!.sunset.getTime());
  });
});

describe("sunAltitude", () => {
  it("is about -0.8 deg at the computed sunset", () => {
    const sun = getSunTimes(new Date(Date.UTC(2026, 9, 10)), LAT, LON)!;
    expect(Math.abs(sunAltitude(sun.sunset, LAT, LON) + 0.833)).toBeLessThan(0.5);
    expect(Math.abs(sunAltitude(sun.sunrise, LAT, LON) + 0.833)).toBeLessThan(0.5);
  });

  it("peaks near 65 deg at midsummer noon in Bratislava", () => {
    const sun = getSunTimes(new Date(Date.UTC(2026, 5, 21)), LAT, LON)!;
    const noon = new Date((sun.sunrise.getTime() + sun.sunset.getTime()) / 2);
    expect(Math.abs(sunAltitude(noon, LAT, LON) - 65.3)).toBeLessThan(0.7);
  });

  it("is low in winter and below the horizon at night", () => {
    const sun = getSunTimes(new Date(Date.UTC(2026, 11, 21)), LAT, LON)!;
    const noon = new Date((sun.sunrise.getTime() + sun.sunset.getTime()) / 2);
    expect(Math.abs(sunAltitude(noon, LAT, LON) - 18.4)).toBeLessThan(0.7);
    expect(sunAltitude(new Date(Date.UTC(2026, 11, 21, 23)), LAT, LON)).toBeLessThan(-30);
  });
});
