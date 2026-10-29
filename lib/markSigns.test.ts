import { describe, expect, it } from "vitest";
import { cleanRuns, markSigns } from "@/lib/markSigns";
import type { TripDetail } from "@/lib/tripSchema";

// A straight walk north, one point every ~11 m (0.0001° of latitude).
const path: TripDetail["path"] = Array.from({ length: 101 }, (_, i) => [19, 48 + i * 0.0001, null]);

describe("markSigns", () => {
  it("puts a sign where the marking changes, with the colour before it for the way back", () => {
    const { start, signs } = markSigns({ path, marking_runs: [{ from: 0, to: 40, colour: "red" }, { from: 40, to: 100, colour: "blue" }] });
    expect(start).toBe("red");
    expect(signs).toHaveLength(1);
    expect(signs[0]).toMatchObject({ colour: "blue", before: "red" });
    expect(signs[0].location.lat).toBeCloseTo(48.004);
  });

  it("drops a few metres of road between two stretches of the same marking", () => {
    const runs = cleanRuns(path, [
      { from: 0, to: 40, colour: "red" },
      { from: 40, to: 43, colour: null },
      { from: 43, to: 100, colour: "red" },
    ]);
    expect(runs).toEqual([expect.objectContaining({ from: 0, to: 100, colour: "red" })]);
  });

  it("starts the next marking where the old one ends when a short unmarked step sits between", () => {
    const { signs } = markSigns({
      path,
      marking_runs: [
        { from: 0, to: 40, colour: "red" },
        { from: 40, to: 43, colour: null },
        { from: 43, to: 100, colour: "green" },
      ],
    });
    expect(signs).toEqual([expect.objectContaining({ colour: "green", before: "red" })]);
    expect(signs[0].location.lat).toBeCloseTo(48.0043);
  });

  it("keeps a long unmarked stretch as a change of its own", () => {
    const { signs } = markSigns({
      path,
      marking_runs: [
        { from: 0, to: 30, colour: "red" },
        { from: 30, to: 60, colour: null },
        { from: 60, to: 100, colour: "red" },
      ],
    });
    expect(signs.map((s) => s.colour)).toEqual([null, "red"]);
  });

  it("has no signs for a walk on one marking or without runs", () => {
    expect(markSigns({ path, marking_runs: [{ from: 0, to: 100, colour: "yellow" }] }).signs).toEqual([]);
    expect(markSigns({ path, marking_runs: [] })).toEqual({ start: null, signs: [] });
  });
});
