import { describe, expect, it } from "vitest";
import { townFrom } from "@/lib/townNames";

describe("townFrom", () => {
  it("uses zo before s, z, š, ž", () => {
    expect(townFrom("sk", "stara-tura", "Stará Turá")).toBe("zo Starej Turej");
    expect(townFrom("sk", "bratislava", "Bratislava")).toBe("z Bratislavy");
  });
  it("says from in English", () => {
    expect(townFrom("en", "bratislava", "Bratislava")).toBe("from Bratislava");
  });
});
