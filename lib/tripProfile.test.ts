import { describe, expect, it } from "vitest";
import { buildProfile, stepHours, trimProfile, withStops } from "./tripProfile";
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

describe("trimProfile", () => {
  it("cuts the skipped start and end and keeps the goal", () => {
    const p = buildProfile({ ...base, route: "tam-a-spat" } as TripDetail)!;
    const t = trimProfile(p, 0.25, 0.15);
    expect(t.points[0].at).toBe(0);
    expect(t.points[t.points.length - 1].at).toBe(1);
    expect(t.points[0].ele).toBeGreaterThan(500);
    expect(t.points[t.goalIndex].ele).toBe(600);
    expect(trimProfile(p, 0, 0)).toBe(p);
  });
});

describe("places and stops", () => {
  const trip = {
    ...base,
    slug: "vrch",
    route: "tam-a-spat",
    pois: [{ kind: "obcerstvenie", name: "Bufet", location: { lat: 49.001, lon: 19 }, osm: null }],
  } as unknown as TripDetail;

  it("finds where the walk passes a place, there and back", () => {
    const p = buildProfile(trip)!;
    expect(p.places).toHaveLength(1);
    expect(p.places![0].id).toBe("vrch:poi:0");
    expect(p.places![0].out).toBeCloseTo(p.points[1].at);
    expect(p.places![0].back).toBeCloseTo(p.points[3].at);
  });

  it("stands still at a stop and moves the rest of the walk later", () => {
    const p = buildProfile(trip)!;
    // 60 min on foot, 30 of them at the buffet on the way back.
    const s = withStops(p, [{ at: p.places![0].back!, min: 30, name: "Bufet" }], 60);
    expect(s.pauses).toHaveLength(1);
    expect(s.pauses![0].to - s.pauses![0].from).toBeCloseTo(0.5);
    // Before the stop, the walk is squeezed into the walking half; the end is still the end.
    expect(s.points[s.goalIndex].at).toBeCloseTo(p.points[p.goalIndex].at * 0.5);
    expect(s.points[s.points.length - 1].at).toBeCloseTo(1);
    const flat = s.points.filter((x) => x.at >= s.pauses![0].from - 1e-9 && x.at <= s.pauses![0].to + 1e-9);
    expect(new Set(flat.map((x) => x.ele)).size).toBe(1);
  });

  it("puts a stop at the goal after arriving there", () => {
    const p = buildProfile(trip)!;
    const goalAt = p.points[p.goalIndex].at;
    const s = withStops(p, [{ at: goalAt, min: 30, name: "Obed" }], 60);
    expect(s.points[s.goalIndex].at).toBeCloseTo(s.pauses![0].from);
  });
});
