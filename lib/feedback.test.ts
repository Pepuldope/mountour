import { describe, expect, it } from "vitest";
import { parseFeedback } from "@/lib/feedback";

describe("parseFeedback", () => {
  it("takes an idea without a topic or email", () => {
    expect(parseFeedback({ kind: "napad", text: "  Super web  ", lang: "sk" })).toEqual({
      kind: "napad", topic: null, slug: null, text: "Super web", email: null, lang: "sk",
    });
  });
  it("needs a topic for a problem report", () => {
    expect(parseFeedback({ kind: "chyba", text: "Parkovisko je zavreté" })).toBeNull();
    expect(parseFeedback({ kind: "chyba", topic: "parkovisko", slug: "sitno", text: "Parkovisko je zavreté" })?.topic).toBe("parkovisko");
  });
  it("refuses odd input", () => {
    expect(parseFeedback({ kind: "spam", text: "hello" })).toBeNull();
    expect(parseFeedback({ kind: "napad", text: "ok" })).toBeNull();
    expect(parseFeedback({ kind: "napad", text: "hello", email: "not an email" })).toBeNull();
    expect(parseFeedback({ kind: "napad", text: "hello", slug: "../x" })).toBeNull();
  });
  it("keeps a valid email and cuts long text", () => {
    const f = parseFeedback({ kind: "napad", text: "x".repeat(3000), email: " a@b.sk " });
    expect(f?.email).toBe("a@b.sk");
    expect(f?.text.length).toBe(1500);
  });
});
