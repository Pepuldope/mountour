import { describe, expect, it } from "vitest";
import { clientIp, isBot, localDay, visitorHash } from "./visitDays";

describe("localDay", () => {
  it("uses Slovak local time, not UTC", () => {
    // 23:30 UTC on 31 Oct is already 1 Nov 00:30 in Bratislava (CET).
    expect(localDay(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
    expect(localDay(new Date("2026-10-10T12:00:00Z"))).toBe("2026-10-10");
  });
});

describe("visitorHash", () => {
  it("is stable within a month and changes the next month", async () => {
    const a = await visitorHash("s", "2026-10-01", "1.2.3.4", "UA");
    const b = await visitorHash("s", "2026-10-28", "1.2.3.4", "UA");
    const c = await visitorHash("s", "2026-11-01", "1.2.3.4", "UA");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("depends on the secret salt", async () => {
    const a = await visitorHash("one", "2026-10-01", "1.2.3.4", "UA");
    const b = await visitorHash("two", "2026-10-01", "1.2.3.4", "UA");
    expect(a).not.toBe(b);
  });
});

describe("clientIp", () => {
  it("prefers Cloudflare's header, then the first forwarded address", () => {
    expect(clientIp(new Headers({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("isBot", () => {
  it("skips crawlers and link previews", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1")).toBe(false);
  });
});
