import { describe, expect, it } from "vitest";
import { estimateDriveMin } from "./drive";

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
