import { describe, expect, it } from "vitest";
import { estimateDriveMin, quickDriveMin } from "./drive";

describe("estimateDriveMin", () => {
  it("stays close to the real drive on a long trip", () => {
    // Bratislava -> Valaská Dubová (Veľký Choč): 170 min by the router.
    const min = estimateDriveMin({ lat: 48.1486, lon: 17.1077 }, { lat: 49.1336, lon: 19.2621 });
    expect(min).toBeGreaterThanOrEqual(150);
    expect(min).toBeLessThanOrEqual(210);
  });

  it("keeps short drives short", () => {
    expect(estimateDriveMin({ lat: 48.1486, lon: 17.1077 }, { lat: 48.2, lon: 17.15 })).toBeLessThanOrEqual(15);
  });
});

describe("quickDriveMin", () => {
  const drives = { town: { name: "Mesto", lat: 49, lon: 19 }, minutes: {} };
  const trip = { lat: 49.5, lon: 19 };
  it("uses the table as it is from the town itself", () => {
    expect(quickDriveMin({ lat: 49.0, lon: 19 }, trip, drives, 40)).toBe(40);
  });
  it("is shorter from a start on the way, longer from one behind the town", () => {
    expect(quickDriveMin({ lat: 49.05, lon: 19 }, trip, drives, 40)).toBe(33);
    expect(quickDriveMin({ lat: 48.95, lon: 19 }, trip, drives, 40)).toBe(47);
  });
});
