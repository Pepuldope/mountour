import { describe, expect, it } from "vitest";
import { countedDetail } from "./eventCounts";

describe("countedDetail", () => {
  it("keeps listed actions with their allowed details", () => {
    expect(countedDetail("start_set", "gps")).toBe("gps");
    expect(countedDetail("share_sent", "0-2 min")).toBe("0-2 min");
    expect(countedDetail("nav_open", undefined)).toBe("");
  });

  it("drops anything else, so the table stays a few rows a month", () => {
    expect(countedDetail("trip_open", "")).toBeNull();
    expect(countedDetail("start_set", "Bratislava")).toBeNull();
    expect(countedDetail("toString", "")).toBeNull();
    expect(countedDetail(42, "")).toBeNull();
  });
});
