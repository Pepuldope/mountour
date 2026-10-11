import { describe, expect, it } from "vitest";
import { cellsAround, pickHomeStop } from "./stops";

const from = { lat: 48.15, lon: 17.1 };

describe("pickHomeStop", () => {
  it("picks the nearest stop", () => {
    const s = pickHomeStop(
      [
        ["Ďaleko", "a", 48.16, 17.1],
        ["Blízko", "a", 48.151, 17.1],
      ],
      from
    );
    expect(s?.name).toBe("Blízko");
    expect(s?.mode).toBe("autobus");
    expect(s?.distance_m).toBeGreaterThan(100);
  });

  it("prefers a train station not much further", () => {
    const s = pickHomeStop(
      [
        ["Roh", "a", 48.151, 17.1],
        ["Stanica", "v", 48.155, 17.1],
      ],
      from
    );
    expect(s?.name).toBe("Stanica");
    expect(s?.mode).toBe("vlak");
  });

  it("finds nothing out of reach", () => {
    expect(pickHomeStop([["Iné mesto", "a", 48.5, 17.1]], from)).toBeNull();
  });
});

describe("cellsAround", () => {
  const grid = { lon0: 16.75, lat0: 47.7, dx: 0.5, dy: 0.25 };
  it("adds the neighbour cell near an edge", () => {
    const all = new Set(["0_1", "1_1", "0_2"]);
    expect(cellsAround(grid, all, { lat: 47.96, lon: 17.24 }).sort()).toEqual(["0_1", "1_1"]);
  });
});
