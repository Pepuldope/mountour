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
  it("leaves out the stretch along the trip's own line", () => {
    // The trip ends at a junction going up the red line; the side path goes on north along a yellow one.
    const trip = [{ lat: 48, lon: 19 }, { lat: 48.004, lon: 19 }];
    const red = { code: "r", pts: trip, box: [19, 48, 19, 48.004] as [number, number, number, number] };
    const yellow = { code: "y", pts: [{ lat: 48.004, lon: 19 }, { lat: 48.01, lon: 19 }], box: [19, 48.004, 19, 48.01] as [number, number, number, number] };
    const side: [number, number][] = [[48.003, 19], [48.004, 19], [48.008, 19]];
    expect(markingAlong(side, [red, yellow], trip)).toBe("yellow");
    expect(markingAlong(side, [{ ...red, pts: [...red.pts, ...yellow.pts], box: [19, 48, 19, 48.01] }], trip)).toBe("red");
    expect(markingAlong([[48.001, 19], [48.003, 19]], [red, yellow], trip)).toBeUndefined();
  });
  it("is unknown without colour data", () => {
    expect(markingAlong(walk(19), [line("", 19)])).toBeUndefined();
    expect(markingAlong(walk(19), [])).toBeUndefined();
  });
});
