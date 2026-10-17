import { describe, expect, it } from "vitest";
import { fromOtherSite, overRouteLimit } from "./routeGuard";

const req = (headers: Record<string, string> = {}) => new Request("https://example.org/api/drive?from=48.1,17.1&to=49,20", { headers });

describe("route guards", () => {
  it("turns away other sites' pages, lets our pages and plain requests through", () => {
    expect(fromOtherSite(req({ "Sec-Fetch-Site": "cross-site" }))).toBe(true);
    expect(fromOtherSite(req({ "Sec-Fetch-Site": "same-site" }))).toBe(true);
    expect(fromOtherSite(req({ "Sec-Fetch-Site": "same-origin" }))).toBe(false);
    expect(fromOtherSite(req({ "Sec-Fetch-Site": "none" }))).toBe(false);
    expect(fromOtherSite(req())).toBe(false);
  });

  it("without the Cloudflare limiter (local dev) nothing is limited", async () => {
    expect(await overRouteLimit(req())).toBeNull();
  });
});
