import { describe, expect, it, vi } from "vitest";
import { finishDrive, simplifyLine } from "./routing";

const road = { durationMin: 30, distanceM: 30000, points: [[48.0, 19.0], [49.0, 19.0]] as [number, number][] };

describe("finishDrive", () => {
  it("leaves a route that reaches the parking alone", async () => {
    const tail = vi.fn();
    expect(await finishDrive(road, [49.0003, 19.0], tail)).toBe(road);
    expect(tail).not.toHaveBeenCalled();
  });

  it("follows the ways for a last stretch the car router skipped", async () => {
    const last = { durationMin: 10, distanceM: 1000, points: [[49.0, 19.0], [49.004, 19.003], [49.008, 19.0]] as [number, number][] };
    const r = await finishDrive(road, [49.008, 19.0], async () => last);
    expect(r.points).toHaveLength(5);
    expect(r.points[r.points.length - 1]).toEqual([49.008, 19.0]);
    expect(r.distanceM).toBe(31000);
    expect(r.durationMin).toBe(33);
  });

  it("ignores a detour far longer than the gap, and a failed router", async () => {
    const far = { durationMin: 60, distanceM: 9000, points: [[49.0, 19.0], [49.008, 19.0]] as [number, number][] };
    expect(await finishDrive(road, [49.008, 19.0], async () => far)).toBe(road);
    expect(await finishDrive(road, [49.008, 19.0], () => Promise.reject(new Error("down")))).toBe(road);
  });
});

describe("simplifyLine", () => {
  it("drops points on a straight road and keeps the bends", () => {
    const straight: [number, number][] = Array.from({ length: 50 }, (_, i) => [49 + i * 0.0001, 19]);
    expect(simplifyLine(straight, 10)).toEqual([straight[0], straight[49]]);
    // A hairpin: out north, then back south 200 m to the east.
    const hairpin: [number, number][] = [...straight, [49.0049, 19.003], [49.0, 19.003]];
    const s = simplifyLine(hairpin, 10);
    expect(s).toContainEqual([49.0049, 19.0]);
    expect(s).toContainEqual([49.0049, 19.003]);
    expect(s.length).toBeLessThan(6);
  });
});
