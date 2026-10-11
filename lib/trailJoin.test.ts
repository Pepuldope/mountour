import { describe, expect, it } from "vitest";
import { joinedMinutes, trailJoin } from "./trailJoin";

// A straight climb north, ~111 m between points, 50 m up each step.
const path: [number, number, number | null][] = Array.from({ length: 11 }, (_, i) => [19.0, 49.0 + i * 0.001, 500 + i * 50]);

describe("trailJoin", () => {
  it("keeps the start when the parking is next to it", () => {
    expect(trailJoin(path, { lat: 49.0, lon: 19.0005 }, 40, false)).toBeNull();
  });

  it("joins part-way when parked up the trail", () => {
    // Beside point 5, ~550 m from the start.
    const j = trailJoin(path, { lat: 49.005, lon: 19.0003 }, 560, false)!;
    expect(j.location).toEqual({ lat: 49.005, lon: 19.0 });
    expect(j.walk_m).toBeLessThan(30);
    expect(j.skip_m).toBeGreaterThan(1000);
    expect(j.skip_ascent_m).toBe(250);
    // Uphill costs more than downhill, and half the trail is skipped both ways.
    expect(j.skip_out).toBeGreaterThan(j.skip_back);
    expect(j.skip_out + j.skip_back).toBeCloseTo(0.5, 2);
  });

  it("keeps a loop's full length", () => {
    const j = trailJoin(path, { lat: 49.005, lon: 19.0003 }, 560, true)!;
    expect(j.skip_m).toBe(0);
    expect(j.skip_out + j.skip_back).toBe(0);
  });

  it("doesn't join when the trail is no closer than the start", () => {
    expect(trailJoin(path, { lat: 48.999, lon: 19.0 }, 111, false)).toBeNull();
  });
});

describe("joinedMinutes", () => {
  it("drops the skipped share, rounded to 5", () => {
    expect(joinedMinutes(120, null)).toBe(120);
    expect(joinedMinutes(120, { skip_out: 0.3, skip_back: 0.2 })).toBe(60);
  });
});
