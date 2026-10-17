import { describe, expect, it, vi } from "vitest";
import { RateLimited, dropDeadEnd, finishDrive, simplifyLine, walkRoute } from "./routing";

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

  it("says when the last stretch could not be asked for, not when it was a detour", async () => {
    const far = { durationMin: 60, distanceM: 9000, points: [[49.0, 19.0], [49.008, 19.0]] as [number, number][] };
    let failed = 0;
    await finishDrive(road, [49.008, 19.0], async () => far, () => failed++);
    expect(failed).toBe(0);
    await finishDrive(road, [49.008, 19.0], () => Promise.reject(new Error("down")), () => failed++);
    expect(failed).toBe(1);
  });
});

describe("dropDeadEnd", () => {
  // North up a dead-end road to 49.01; the parking is east of it, halfway up.
  const north: [number, number][] = Array.from({ length: 11 }, (_, i) => [49 + i * 0.001, 19]);
  const drive = { durationMin: 10, distanceM: 1112, points: north };

  it("stops the car where the walk leaves the road it came in by", () => {
    const tail = {
      durationMin: 8,
      distanceM: 780,
      points: [[49.01, 19.0], [49.008, 19.0], [49.006, 19.0], [49.005, 19.0], [49.005, 19.0015], [49.005, 19.003]] as [number, number][],
    };
    const r = dropDeadEnd(drive, tail);
    const end = r.drive.points[r.drive.points.length - 1];
    expect(end[0]).toBeCloseTo(49.005, 4);
    expect(end[1]).toBeCloseTo(19.0, 4);
    expect(r.drive.distanceM).toBeCloseTo(556, -1);
    expect(r.drive.durationMin).toBe(5);
    expect(r.tail.points[0]).toEqual(end);
    expect(r.tail.points[r.tail.points.length - 1]).toEqual([49.005, 19.003]);
    expect(r.tail.distanceM).toBeLessThan(300);
  });

  it("leaves a walk that heads straight off the road alone", () => {
    const tail = { durationMin: 3, distanceM: 220, points: [[49.01, 19.0], [49.01, 19.003]] as [number, number][] };
    const r = dropDeadEnd(drive, tail);
    expect(r.drive).toBe(drive);
    expect(r.tail).toBe(tail);
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

  it("keeps an out-and-back spur that runs past the end of the line", () => {
    // North 500 m, a 300 m dead-end straight on north and back, then on east.
    const spur: [number, number][] = [
      [49.0, 19.0],
      [49.0045, 19.0],
      [49.0072, 19.0],
      [49.0045, 19.0],
      [49.0045, 19.004],
    ];
    expect(simplifyLine(spur, 10)).toContainEqual([49.0072, 19.0]);
    // Start and end on one line with the spur between them, beyond the end.
    const line: [number, number][] = [
      [49.0, 19.0],
      [49.003, 19.0],
      [49.0, 19.0],
      [49.001, 19.0],
    ];
    expect(simplifyLine(line, 10)).toContainEqual([49.003, 19.0]);
  });
});

describe("walkRoute with the router's limits", () => {
  const geo = { features: [{ properties: { summary: { duration: 600, distance: 800 } }, geometry: { coordinates: [[19, 48], [19.01, 48.01]] } }] };

  it("asks the router once for the same two places", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(geo)));
    vi.stubGlobal("fetch", fetchMock);
    const a = await walkRoute("key", [48.1, 19.1], [48.11, 19.11], 1000);
    const b = await walkRoute("key", [48.1, 19.1], [48.11, 19.11], 1000);
    expect(b).toEqual(a);
    expect(a.durationMin).toBe(10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("spends no fallback call when the router says too many requests", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(walkRoute("key", [48.2, 19.2], [48.21, 19.21], 1000)).rejects.toBeInstanceOf(RateLimited);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
