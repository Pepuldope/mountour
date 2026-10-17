import { afterEach, describe, expect, it } from "vitest";
import { KEEP_FOR, withEdgeCache } from "./edgeCache";

const store = new Map<string, Response>();
const g = globalThis as { caches?: unknown };

function fakeCache() {
  store.clear();
  g.caches = {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
    },
  };
}

afterEach(() => delete g.caches);

describe("withEdgeCache", () => {
  it("keys on the given params, so extra query parameters share the answer", async () => {
    fakeCache();
    let calls = 0;
    const compute = async () => (calls++, Response.json({ ok: 1 }));
    await withEdgeCache(new Request("https://x/api/a?lat=1&junk=2"), 60, compute, { lat: "1" });
    await withEdgeCache(new Request("https://x/api/a?junk=3&lat=1"), 60, compute, { lat: "1" });
    expect(calls).toBe(1);
  });

  it("keeps an answer only as long as it asks, and drops the marker", async () => {
    fakeCache();
    const res = await withEdgeCache(new Request("https://x/api/d"), 86400, async () =>
      Response.json({}, { headers: { [KEEP_FOR]: "600" } })
    );
    expect(res.ok).toBe(true);
    const kept = [...store.values()][0];
    expect(kept.headers.get("Cache-Control")).toBe("public, max-age=600");
    expect(kept.headers.get(KEEP_FOR)).toBeNull();
  });

  it("does not keep failed answers", async () => {
    fakeCache();
    await withEdgeCache(new Request("https://x/api/e"), 60, async () => new Response(null, { status: 502 }));
    expect(store.size).toBe(0);
  });
});
