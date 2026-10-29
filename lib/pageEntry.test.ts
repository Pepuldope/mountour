import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pick } from "./pageEntry";

const entry = {
  type: "app",
  meta: { headers: { "x-nextjs-stale-time": "300" } },
  html: '<p>"html":"tricky","rsc":"</p>\\',
  rsc: '0:{"rsc":"x","segmentData":1}',
  segmentData: { "/_tree": "t" },
};

describe("pick", () => {
  it("cuts out just the asked part, even when it contains the field names", () => {
    const text = JSON.stringify(entry);
    expect(pick(text, "html")).toEqual({ type: "app", meta: entry.meta, html: entry.html });
    expect(pick(text, "rsc")).toEqual({ type: "app", meta: entry.meta, rsc: entry.rsc });
  });

  it("parses everything when the layout is not the expected one", () => {
    const text = JSON.stringify({ meta: entry.meta, type: "app", html: "a" });
    expect(pick(text, "html").html).toBe("a");
  });

  // The pages the last build made (after `npm run cf:build`; skipped without one).
  const dir = ".open-next/cache";
  it.runIf(existsSync(dir))("agrees with a full parse on the built pages", () => {
    const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".cache")).slice(0, 400);
    for (const f of files) {
      const text = readFileSync(`${dir}/${f}`, "utf8");
      const full = JSON.parse(text);
      for (const part of ["html", "rsc"] as const) {
        const got = pick(text, part);
        expect(got[part], f).toBe(full[part]);
        expect(got.meta, f).toEqual(full.meta);
        expect(got, f).not.toHaveProperty("segmentData");
      }
    }
  });
});
