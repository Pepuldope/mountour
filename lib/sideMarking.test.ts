import { describe, expect, it } from "vitest";
import { markingAlong } from "@/lib/sideMarking";

const line = (code: string, lon: number) => ({
  code,
  pts: [{ lat: 48, lon }, { lat: 48.01, lon }],
  box: [lon, 48, lon, 48.01] as [number, number, number, number],
});
const walk = (lon: number): [number, number][] => Array.from({ length: 5 }, (_, i) => [48 + i * 0.002, lon]);

describe("markingAlong", () => {
  it("reads the colour of the marked line the walk follows", () => {
    expect(markingAlong(walk(19), [line("y", 19), line("r", 19.01)])).toBe("yellow");
  });
  it("is null when the walk runs off marked lines", () => {
    expect(markingAlong(walk(19.005), [line("y", 19), line("r", 19.01)])).toBeNull();
  });
  it("is unknown without colour data", () => {
    expect(markingAlong(walk(19), [line("", 19)])).toBeUndefined();
    expect(markingAlong(walk(19), [])).toBeUndefined();
  });
});
