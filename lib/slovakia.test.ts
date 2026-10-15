import { describe, expect, it } from "vitest";
import { limitBox } from "@/lib/slovakia";

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const aspect = ([[w, s], [e, n]]: [[number, number], [number, number]]) => ((e - w) * Math.PI) / 180 / (mercY(n) - mercY(s));

describe("limitBox", () => {
  it("covers Slovakia with a margin and matches the map's shape", () => {
    for (const [w, h] of [[390, 640], [1200, 560], [800, 800]]) {
      const box = limitBox(w, h);
      expect(box[0][0]).toBeLessThan(16.84);
      expect(box[0][1]).toBeLessThan(47.73);
      expect(box[1][0]).toBeGreaterThan(22.57);
      expect(box[1][1]).toBeGreaterThan(49.62);
      expect(aspect(box)).toBeCloseTo(w / h, 6);
    }
  });

  it("a tall phone map widens north and south, not east and west", () => {
    const box = limitBox(390, 640);
    expect(box[0][0]).toBeCloseTo(16.64, 6);
    expect(box[1][1]).toBeGreaterThan(51);
  });
});
