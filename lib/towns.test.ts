import { describe, expect, it } from "vitest";
import { findTown } from "@/lib/towns";

describe("findTown", () => {
  it("matches ignoring case and diacritics", () => {
    expect(findTown("zilina")?.label).toBe("Žilina");
    expect(findTown(" BANSKÁ bystrica ")?.label).toBe("Banská Bystrica");
  });
  it("returns null for towns outside the list", () => {
    expect(findTown("Pezinok")).toBeNull();
  });
});
