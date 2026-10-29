import { describe, expect, it } from "vitest";
import { distanceAlongM, haversineM, legOffPath } from "./geo";

describe("haversineM", () => {
  it("is zero for identical points", () => {
    expect(haversineM({ lat: 48.15, lon: 17.1 }, { lat: 48.15, lon: 17.1 })).toBe(0);
  });

  it("matches the known Bratislava - Viedeň distance (~55 km)", () => {
    const bratislava = { lat: 48.1486, lon: 17.1077 };
    const viden = { lat: 48.2082, lon: 16.3738 };
    const d = haversineM(bratislava, viden);
    expect(d).toBeGreaterThan(53000);
    expect(d).toBeLessThan(57000);
  });

  it("is symmetric", () => {
    const a = { lat: 48.17, lon: 17.0 };
    const b = { lat: 48.4, lon: 17.3 };
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 6);
  });
});

describe("distanceAlongM", () => {
  const path: [number, number][] = [
    [19.0, 49.0],
    [19.0, 49.01],
    [19.0, 49.02],
  ];
  it("measures to the nearest path point", () => {
    expect(distanceAlongM(path, { lat: 49.0, lon: 19.0 })).toBe(0);
    expect(Math.round(distanceAlongM(path, { lat: 49.0199, lon: 19.0005 }) / 10)).toBe(222);
  });
});

describe("legOffPath", () => {
  // A trail running north; the path to the place turns east 300 m up.
  const trail = Array.from({ length: 11 }, (_, i) => ({ lat: 48 + i * 0.001, lon: 19 }));
  it("starts the side walk where it leaves the trail, not where the router joined it", () => {
    const route: [number, number][] = [
      [48.002, 19],
      [48.0025, 19.00005],
      [48.003, 19],
      [48.003, 19.002],
      [48.003, 19.004],
    ];
    expect(legOffPath(trail, [48.002, 19], route, [48.003, 19.005])).toEqual([
      [48.003, 19],
      [48.003, 19.002],
      [48.003, 19.004],
      [48.003, 19.005],
    ]);
  });
  it("keeps the whole line when the route starts off the trail", () => {
    const route: [number, number][] = [[48.002, 19.001], [48.002, 19.003]];
    expect(legOffPath(trail, [48.002, 19], route, [48.002, 19.004])).toEqual([[48.002, 19], ...route, [48.002, 19.004]]);
  });
});
