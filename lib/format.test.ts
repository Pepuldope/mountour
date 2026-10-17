import { describe, expect, it } from "vitest";
import { formatDateSk, formatFromUser, stopLabel } from "./format";

describe("format", () => {
  it("keeps a date on one line", () => {
    expect(formatDateSk("2026-10-12")).toBe("12. 10. 2026");
  });

  it("shows cp.sk stop names with a normal comma", () => {
    expect(stopLabel("Valaská Dubová,,OcÚ")).toBe("Valaská Dubová, OcÚ");
    expect(stopLabel("Hodžovo nám.")).toBe("Hodžovo nám.");
  });

  it("gives longer walks in km", () => {
    expect(formatFromUser(1610)).toBe("1,6 km");
    expect(formatFromUser(238)).toBe("240 m");
  });
});

describe("distances", () => {
  it("writes km with a comma, and short walks in metres", async () => {
    const { formatDistance, formatWalk } = await import("./format");
    expect(formatDistance(18400)).toBe("18,4 km");
    expect(formatWalk(350)).toBe("350 m");
    expect(formatWalk(2350)).toBe("2,4 km");
  });
});
