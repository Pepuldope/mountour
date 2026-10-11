import { describe, expect, it } from "vitest";
import { distanceAlongM, haversineM } from "./geo";

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
