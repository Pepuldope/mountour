import { describe, expect, it } from "vitest";
import { defaultDeparture } from "./tripSettings";

describe("defaultDeparture", () => {
  it("leaves soon during the day", () => {
    expect(defaultDeparture(new Date(2026, 9, 12, 9, 5))).toEqual({ date: "2026-10-12", time: "09:15" });
  });

  it("plans the morning, not the middle of the night", () => {
    expect(defaultDeparture(new Date(2026, 9, 12, 0, 10))).toEqual({ date: "2026-10-12", time: "08:00" });
  });

  it("moves to tomorrow when it's late", () => {
    expect(defaultDeparture(new Date(2026, 9, 12, 16, 0))).toEqual({ date: "2026-10-13", time: "08:00" });
  });
});
