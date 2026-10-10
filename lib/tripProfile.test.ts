import { describe, expect, it } from "vitest";
import { buildProfile, stepHours } from "./tripProfile";
import type { TripDetail } from "./tripSchema";

// Three points due north, ~111 m apart, climbing 100 m then flat.
const base = {
  start: { name: "Štart", location: { lat: 49, lon: 19 }, ele_m: 500, osm: null },
  destination: { name: "Vrch", kind: "vrchol", location: { lat: 49.002, lon: 19 }, ele_m: 600, osm: null },
  path: [
    [19, 49, 500],
    [19, 49.001, 600],
    [19, 49.002, null],
  ],
  turnaround_index: 2,
  marking_runs: [
    { from: 0, to: 1, colour: "red" },
    { from: 1, to: 2, colour: "blue" },
  ],
} as unknown as TripDetail;

describe("stepHours", () => {
  it("follows DIN 33466: larger part plus half the smaller", () => {
    expect(stepHours(4000, 0)).toBeCloseTo(1);
    expect(stepHours(0, 300)).toBeCloseTo(1);
    expect(stepHours(0, -500)).toBeCloseTo(1);
    expect(stepHours(4000, 300)).toBeCloseTo(1.5);
  });
});

describe("buildProfile", () => {
  it("walks a there-and-back path out and back, goal at the far end", () => {
    const p = buildProfile({ ...base, route: "tam-a-spat" } as TripDetail)!;
    expect(p.loop).toBe(false);
    expect(p.points.map((x) => x.ele)).toEqual([500, 600, 600, 600, 500]);
    expect(p.goalIndex).toBe(2);
    expect(p.points[0].at).toBe(0);
    expect(p.points[4].at).toBeCloseTo(1);
    // Climbing takes longer than coming down the same slope.
    expect(p.points[1].at).toBeGreaterThan(1 - p.points[3].at);
    // The way back keeps the colour of each stretch.
    expect(p.points.map((x) => x.colour)).toEqual(["red", "red", "blue", "blue", "red"]);
  });

  it("keeps a loop as stored, goal at the turnaround", () => {
    const p = buildProfile({ ...base, route: "okruh", turnaround_index: 1 } as TripDetail)!;
    expect(p.loop).toBe(true);
    expect(p.points).toHaveLength(3);
    expect(p.goalIndex).toBe(1);
    expect(p.goalName).toBe("Vrch");
  });
});
