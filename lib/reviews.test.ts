import { describe, expect, it } from "vitest";
import { parseReview } from "@/lib/reviews";

const ok = { slug: "kamzik", reviewer: "0b5c4b1e-1d2f-4a8e-9c3b-2f6a7d8e9f00", stars: 4, fit: "popis", crowded: true, note: "  pekne  " };

describe("parseReview", () => {
  it("keeps a good review, note trimmed", () => {
    expect(parseReview(ok)).toEqual({ ...ok, note: "pekne" });
  });
  it("optional parts may be left out", () => {
    expect(parseReview({ slug: "kamzik", reviewer: ok.reviewer, stars: 5 })).toEqual({ slug: "kamzik", reviewer: ok.reviewer, stars: 5, fit: null, crowded: null, note: "" });
  });
  it("drops anything off", () => {
    expect(parseReview({ ...ok, stars: 6 })).toBeNull();
    expect(parseReview({ ...ok, stars: 2.5 })).toBeNull();
    expect(parseReview({ ...ok, fit: "nice" })).toBeNull();
    expect(parseReview({ ...ok, slug: "../x" })).toBeNull();
    expect(parseReview({ ...ok, reviewer: "x" })).toBeNull();
    expect(parseReview(null)).toBeNull();
  });
  it("cuts a long note", () => {
    expect(parseReview({ ...ok, note: "a".repeat(1000) })!.note).toHaveLength(280);
  });
});
