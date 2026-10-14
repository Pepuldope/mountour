import { describe, expect, it } from "vitest";
import { defaultDay, defaultDeparture } from "./tripSettings";

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

describe("defaultDay", () => {
  it("is today while the sun is up", () => {
    expect(defaultDay(new Date(2026, 9, 14, 17, 30))).toBe("2026-10-14");
  });

  it("is tomorrow once the sun has set", () => {
    expect(defaultDay(new Date(2026, 9, 14, 18, 40))).toBe("2026-10-15");
  });

  it("is today again after midnight", () => {
    expect(defaultDay(new Date(2026, 9, 15, 0, 30))).toBe("2026-10-15");
  });
});
