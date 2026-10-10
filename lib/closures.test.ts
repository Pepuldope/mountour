import { describe, expect, it } from "vitest";
import { activeClosures, isClosureActive } from "./closures";
import type { Closure } from "./types";

function closure(kind: Closure["kind"], starts_on: string, ends_on: string, id = "c1"): Closure {
  return {
    id,
    trail_id: "t1",
    kind,
    starts_on,
    ends_on,
    reason: "test",
    source_url: "https://example.sk",
    verified_on: "2026-01-01",
  };
}

describe("isClosureActive - jednorazova", () => {
  const c = closure("jednorazova", "2026-03-10", "2026-03-20");

  it("is active on both boundary days", () => {
    expect(isClosureActive(c, "2026-03-10")).toBe(true);
    expect(isClosureActive(c, "2026-03-20")).toBe(true);
  });

  it("is inactive the day before and after", () => {
    expect(isClosureActive(c, "2026-03-09")).toBe(false);
    expect(isClosureActive(c, "2026-03-21")).toBe(false);
  });

  it("compares the year, so the same dates next year are not closed", () => {
    expect(isClosureActive(c, "2027-03-15")).toBe(false);
  });

  it("handles a one-off closure spanning New Year", () => {
    const wrap = closure("jednorazova", "2026-12-20", "2027-01-10");
    expect(isClosureActive(wrap, "2026-12-31")).toBe(true);
    expect(isClosureActive(wrap, "2027-01-05")).toBe(true);
    expect(isClosureActive(wrap, "2026-06-01")).toBe(false);
  });
});

describe("isClosureActive - rocna", () => {
  it("repeats a range within one year every year", () => {
    const c = closure("rocna", "2020-04-01", "2020-04-30");
    expect(isClosureActive(c, "2026-04-01")).toBe(true);
    expect(isClosureActive(c, "2031-04-30")).toBe(true);
    expect(isClosureActive(c, "2026-03-31")).toBe(false);
    expect(isClosureActive(c, "2026-05-01")).toBe(false);
  });

  it("handles a range that wraps New Year (TANAP 1 Nov - 15 Jun)", () => {
    const c = closure("rocna", "2020-11-01", "2021-06-15");
    expect(isClosureActive(c, "2026-11-01")).toBe(true);
    expect(isClosureActive(c, "2026-12-31")).toBe(true);
    expect(isClosureActive(c, "2027-01-01")).toBe(true);
    expect(isClosureActive(c, "2027-06-15")).toBe(true);
    expect(isClosureActive(c, "2027-06-16")).toBe(false);
    expect(isClosureActive(c, "2026-10-31")).toBe(false);
    expect(isClosureActive(c, "2026-08-01")).toBe(false);
  });

  it("treats a single-day range as that one day", () => {
    const c = closure("rocna", "2020-07-04", "2020-07-04");
    expect(isClosureActive(c, "2026-07-04")).toBe(true);
    expect(isClosureActive(c, "2026-07-05")).toBe(false);
  });
});

describe("activeClosures", () => {
  it("keeps only the closures active on the given date", () => {
    const list = [
      closure("jednorazova", "2026-03-10", "2026-03-20", "a"),
      closure("rocna", "2020-11-01", "2021-06-15", "b"),
      closure("rocna", "2020-07-01", "2020-07-31", "c"),
    ];
    expect(activeClosures(list, "2026-03-15").map((c) => c.id)).toEqual(["a", "b"]);
    expect(activeClosures(list, "2026-07-15").map((c) => c.id)).toEqual(["c"]);
    expect(activeClosures(list, "2026-09-15")).toEqual([]);
  });
});
