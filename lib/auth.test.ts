// Sign-in (lib/auth.ts) against an in-memory SQLite in D1's shape, as in lib/tripDb.test.ts.
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D1Like, D1Statement } from "@/lib/d1";

interface DatabaseSync {
  prepare(sql: string): { run(...v: unknown[]): unknown; get(...v: unknown[]): unknown; all(...v: unknown[]): unknown[] };
}
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => DatabaseSync };

let db: D1Like | null = null;
vi.mock("@/lib/d1", () => ({ getDb: async () => db }));
const auth = await import("@/lib/auth");

function d1(sqlite: DatabaseSync): D1Like {
  const statement = (sql: string, values: unknown[] = []): D1Statement => ({
    bind: (...v) => statement(sql, v),
    run: async () => sqlite.prepare(sql).run(...values),
    first: async <T,>() => (sqlite.prepare(sql).get(...values) as T | undefined) ?? null,
    all: async <T,>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
  });
  return { prepare: (sql) => statement(sql), batch: async (s) => { for (const x of s) await x.run(); } };
}

// One database for the file: the tables are made once per process, as on the Worker.
db = d1(new DatabaseSync(":memory:"));

const req = (token?: string) => new Request("https://turuj.sk/", { headers: token ? { cookie: `a=1; ${auth.SESSION_COOKIE}=${token}` } : {} });

describe("helpers", () => {
  it("cleans emails", () => {
    expect(auth.cleanEmail("  Peter@Gmail.COM ")).toBe("peter@gmail.com");
    expect(auth.cleanEmail("peter@gmail")).toBeNull();
    expect(auth.cleanEmail("a b@c.sk")).toBeNull();
    expect(auth.cleanEmail(3)).toBeNull();
  });
  it("only comes back to our own pages", () => {
    expect(auth.safeNext("/trasa/x?d=1")).toBe("/trasa/x?d=1");
    expect(auth.safeNext("//evil.com")).toBe("/");
    expect(auth.safeNext("/\\evil.com")).toBe("/");
    expect(auth.safeNext("https://evil.com")).toBe("/");
    expect(auth.safeNext(null)).toBe("/");
  });
  it("makes 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(auth.randomCode()).toMatch(/^\d{6}$/);
  });
});

describe("email code", () => {
  beforeEach(() => vi.useRealTimers());

  it("signs in with the right code, once", async () => {
    expect(await auth.newLoginCode("a@b.sk", "123456")).toBe("ok");
    expect(await auth.newLoginCode("a@b.sk", "654321")).toBe("wait");
    expect(await auth.checkLoginCode("a@b.sk", "111111")).toBe("wrong");
    expect(await auth.checkLoginCode("a@b.sk", "123456")).toBe("ok");
    expect(await auth.checkLoginCode("a@b.sk", "123456")).toBe("expired");
  });

  it("ends the code after too many wrong tries", async () => {
    expect(await auth.newLoginCode("c@b.sk", "123456")).toBe("ok");
    for (let i = 1; i < auth.CODE_TRIES; i++) expect(await auth.checkLoginCode("c@b.sk", "000000")).toBe("wrong");
    expect(await auth.checkLoginCode("c@b.sk", "000000")).toBe("expired");
    expect(await auth.checkLoginCode("c@b.sk", "123456")).toBe("expired");
  });

  it("lets a code run out", async () => {
    vi.useFakeTimers({ now: Date.now() });
    expect(await auth.newLoginCode("d@b.sk", "123456")).toBe("ok");
    vi.setSystemTime(Date.now() + (auth.CODE_MIN + 1) * 60_000);
    expect(await auth.checkLoginCode("d@b.sk", "123456")).toBe("expired");
  });
});

describe("accounts and sessions", () => {
  it("keeps one account per email, and Google joins it", async () => {
    const a = await auth.accountFor("e@b.sk");
    const g = await auth.accountFor("e@b.sk", { sub: "g1", name: "Eva" });
    expect(g.id).toBe(a.id);
    expect(g.name).toBe("Eva");
    expect((await auth.accountFor("e@b.sk")).name).toBe("Eva");
  });

  it("starts, reads and ends a session", async () => {
    const a = await auth.accountFor("f@b.sk");
    const token = await auth.startSession(a.id);
    expect(await auth.currentAccount(req(token))).toMatchObject({ id: a.id, email: "f@b.sk" });
    expect(await auth.currentAccount(req("x".repeat(43)))).toBeNull();
    expect(await auth.currentAccount(req())).toBeNull();
    await auth.endSession(req(token));
    expect(await auth.currentAccount(req(token))).toBeNull();
  });
});
