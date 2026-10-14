import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unpackLines } from "@/lib/packedLines";
import type { PackedLines } from "@/lib/packedLines";

describe("unpackLines", () => {
  it("rebuilds lines and properties from steps", () => {
    const packed: PackedLines = {
      format: "lines-v1",
      scale: 10000,
      props: { p: [2, 0], s: ["a", "b"] },
      lines: [
        [180475, 488834, -20, 62],
        [176759, 488511, 14, 16, 43, 12],
      ],
    };
    const fc = unpackLines(packed);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].properties).toEqual({ p: 2, s: "a" });
    expect((fc.features[0].geometry as GeoJSON.LineString).coordinates).toEqual([
      [18.0475, 48.8834],
      [18.0455, 48.8896],
    ]);
    expect((fc.features[1].geometry as GeoJSON.LineString).coordinates[2]).toEqual([17.6816, 48.8539]);
  });

  it("passes plain GeoJSON through", () => {
    const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    expect(unpackLines(fc)).toBe(fc);
  });

  it("reads the files the site ships", () => {
    for (const path of ["public/data/trails/overview.json", "public/data/map/overview.json"]) {
      const fc = unpackLines(JSON.parse(readFileSync(path, "utf8")));
      expect(fc.features.length).toBeGreaterThan(100);
      const [lon, lat] = (fc.features[0].geometry as GeoJSON.LineString).coordinates[0];
      expect(lon).toBeGreaterThan(16);
      expect(lon).toBeLessThan(23);
      expect(lat).toBeGreaterThan(47);
      expect(lat).toBeLessThan(50);
    }
  });
});
