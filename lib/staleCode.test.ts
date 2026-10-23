import { describe, expect, it } from "vitest";
import { isStaleCodeError, mayReloadNow, RELOAD_GUARD_MS } from "./staleCode";

describe("isStaleCodeError", () => {
  it("knows missing code files", () => {
    const chunk = Object.assign(new Error("Loading chunk 123 failed."), { name: "ChunkLoadError" });
    expect(isStaleCodeError(chunk)).toBe(true);
    expect(isStaleCodeError(new Error("Loading chunk static/chunks/abc.js failed."))).toBe(true);
    expect(isStaleCodeError(new TypeError("Failed to fetch dynamically imported module: https://x/_next/a.js"))).toBe(true);
    expect(isStaleCodeError(new TypeError("Importing a module script failed."))).toBe(true);
  });

  it("leaves other errors alone", () => {
    expect(isStaleCodeError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isStaleCodeError(new Error("x is undefined"))).toBe(false);
    expect(isStaleCodeError(null)).toBe(false);
    expect(isStaleCodeError("ChunkLoadError")).toBe(false);
  });
});

describe("mayReloadNow", () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it("reloads once, then not again within the guard", () => {
    const s = store();
    expect(mayReloadNow(s, 1_000_000)).toBe(true);
    expect(mayReloadNow(s, 1_000_000 + RELOAD_GUARD_MS - 1)).toBe(false);
    expect(mayReloadNow(s, 1_000_000 + RELOAD_GUARD_MS)).toBe(true);
  });
});
