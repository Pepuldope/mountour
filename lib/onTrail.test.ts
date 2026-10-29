import { describe, expect, it } from "vitest";
import { buildWalk, locate, timing, turnBack } from "@/lib/onTrail";
import type { WalkTrip } from "@/lib/onTrail";

// A straight walk north, one point every ~11 m (0.0001° of latitude), 1.1 km, flat.
const path: WalkTrip["path"] = Array.from({ length: 101 }, (_, i) => [19, 48 + i * 0.0001, 500]);
const runs = [
  { from: 0, to: 40, colour: "red" as const },
  { from: 40, to: 100, colour: "blue" as const },
];
const there: WalkTrip = { path, marking_runs: runs, turnaround_index: 100, route: "tam-a-spat" };
const at = (i: number, east = 0) => ({ lat: 48 + i * 0.0001, lon: 19 + east });

describe("onTrail", () => {
  const walk = buildWalk(there)!;

  it("walks a there-and-back trip up and down again", () => {
    expect(walk.points).toHaveLength(201);
    expect(walk.goal).toBe(100);
    expect(walk.m[200]).toBeCloseTo(2 * walk.m[100]);
  });

  it("places the first fix on the way there, with the next marking ahead", () => {
    const pos = locate(walk, at(20), null);
    expect(pos.at).toBeCloseTo(20);
    expect(pos.pastGoal).toBe(false);
    expect(pos.colour).toBe("red");
    expect(pos.next?.colour).toBe("blue");
    expect(pos.next?.inM).toBeGreaterThan(200);
    expect(pos.next?.inM).toBeLessThan(250);
    expect(pos.doneShare).toBeCloseTo(0.1, 2);
  });

  it("switches to the way back once the goal was reached", () => {
    const top = locate(walk, at(99), 90);
    expect(top.pastGoal).toBe(true);
    const down = locate(walk, at(60), top.memo);
    expect(down.at).toBeCloseTo(140);
    expect(down.colour).toBe("blue");
    expect(down.next?.colour).toBe("red");
  });

  it("can turn back early", () => {
    const pos = locate(walk, at(30), turnBack(walk, 30));
    expect(pos.at).toBeCloseTo(170);
    expect(pos.next).toBeNull();
  });

  it("says when the visitor is off the route", () => {
    expect(locate(walk, at(50, 0.001), null).offRoute).toBe(false); // ~75 m
    expect(locate(walk, at(50, 0.003), null).offRoute).toBe(true); // ~220 m
  });

  it("times the rest and the latest arrival at the goal", () => {
    const pos = locate(walk, at(50), null);
    const now = new Date("2026-10-29T12:00:00Z");
    const sunset = new Date("2026-10-29T15:40:00Z");
    const t = timing(pos, 120, now, sunset);
    expect(t.leftMin).toBe(90);
    expect(t.finish.toISOString()).toBe("2026-10-29T13:30:00.000Z");
    expect(t.latestAtGoal?.toISOString()).toBe("2026-10-29T14:40:00.000Z");
    expect(t.late).toBe(false);
    expect(t.atGoal?.toISOString()).toBe("2026-10-29T12:30:00.000Z");
    expect(t.backIfTurned?.toISOString()).toBe("2026-10-29T12:30:00.000Z");
    expect(timing(pos, 600, now, sunset).late).toBe(true);
  });

  it("follows a loop that ends where it starts", () => {
    const ring: WalkTrip["path"] = [...path, ...path.slice(0, 100).reverse().map(([lon, lat, e]) => [lon + 0.002, lat, e] as [number, number, number])];
    ring.push([19, 48, 500]);
    const loop = buildWalk({ path: ring, marking_runs: [{ from: 0, to: ring.length - 1, colour: "green" }], turnaround_index: 100, route: "okruh" })!;
    expect(locate(loop, at(0), null).at).toBeLessThan(1);
    expect(locate(loop, at(0), 195).at).toBeGreaterThan(195);
  });
});
