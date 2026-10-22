import { describe, expect, it } from "vitest";
import { walkThereMinutes } from "@/lib/walkThere";

describe("walkThereMinutes", () => {
  it("offers a walk only from close by", () => {
    expect(walkThereMinutes(2600)).toBeNull();
    expect(walkThereMinutes(2500)).toBe(45);
  });
  it("never less than 5 minutes, rounded up to 5", () => {
    expect(walkThereMinutes(0)).toBe(5);
    expect(walkThereMinutes(1000)).toBe(20);
  });
});
