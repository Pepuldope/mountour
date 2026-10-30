import { getDb } from "@/lib/d1";
import type { D1Like } from "@/lib/d1";

// Accounts (Peter, 2026-10-30: "Google + email code"). No passwords: a person signs in with
// Google or with a 6-digit code sent to their email. The browser keeps a random session token in
// an httpOnly cookie; the database keeps only its SHA-256, so a copy of the database can't sign
// anyone in. Tables live in the site's one D1 database (lib/d1.ts).

export const SESSION_COOKIE = "turuj_s";
/** How long one sign-in lasts. */
export const SESSION_DAYS = 180;
/** How long an emailed code works, and how many wrong tries it takes. */
export const CODE_MIN = 15;
export const CODE_TRIES = 5;
/** A new code for the same email only after this long (each one is an email from the free 100 a day). */
export const CODE_GAP_S = 60;

export interface Account {
  id: string;
  email: string;
  name: string | null;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, google TEXT UNIQUE, created TEXT NOT NULL, seen TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS account_session (token TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL) WITHOUT ROWID`,
  // Sign-ins per month and way, for /statistiky (Peter, 2026-10-30: "how many people sign in and register").
  `CREATE TABLE IF NOT EXISTS signin_month (month TEXT NOT NULL, method TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (month, method)) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS login_code (email TEXT PRIMARY KEY, code TEXT NOT NULL, expires INTEGER NOT NULL, sent INTEGER NOT NULL, tries INTEGER NOT NULL) WITHOUT ROWID`,
];
let ready: Promise<unknown> | null = null;

async function db(): Promise<D1Like | null> {
  const d = await getDb();
  if (!d) return null;
  ready ??= d.batch(SCHEMA.map((s) => d.prepare(s))).catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return d;
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A 6-digit code, every value equally likely. */
export function randomCode(): string {
  const a = new Uint32Array(1);
  // Reject the top sliver so 0-999,999 stay even.
  do crypto.getRandomValues(a);
  while (a[0] >= 4_294_000_000);
  return String(a[0] % 1_000_000).padStart(6, "0");
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

/** A plain, lower-cased email, or null. */
export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL.test(e) ? e : null;
}

/** The token from the request's session cookie. */
export function sessionToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([A-Za-z0-9_-]{20,})`));
  return m?.[1] ?? null;
}

export function sessionCookie(token: string, maxAgeS = SESSION_DAYS * 86400): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAgeS}; HttpOnly; Secure; SameSite=Lax`;
}

/** The signed-in account for this request, or null. */
export async function currentAccount(req: Request): Promise<Account | null> {
  const token = sessionToken(req);
  if (!token) return null;
  const d = await db();
  if (!d) return null;
  const row = await d
    .prepare(`SELECT a.id, a.email, a.name FROM account_session s JOIN account a ON a.id = s.account WHERE s.token = ? AND s.expires > ?`)
    .bind(await sha256(token), Date.now())
    .first<Account>();
  return row ?? null;
}

export type SignInMethod = "google" | "email";

/** A new session for the account; returns the token for the cookie. */
export async function startSession(accountId: string, method: SignInMethod): Promise<string> {
  const d = await db();
  if (!d) throw new Error("no database");
  const token = randomToken();
  const now = Date.now();
  await d.batch([
    d.prepare(`INSERT INTO account_session (token, account, expires) VALUES (?, ?, ?)`).bind(await sha256(token), accountId, now + SESSION_DAYS * 86400_000),
    // Expired sessions of anyone go now and then, so the table stays small.
    d.prepare(`DELETE FROM account_session WHERE expires < ?`).bind(now),
    d.prepare(`UPDATE account SET seen = ? WHERE id = ?`).bind(new Date(now).toISOString(), accountId),
    d
      .prepare(`INSERT INTO signin_month (month, method, n) VALUES (?, ?, 1) ON CONFLICT (month, method) DO UPDATE SET n = n + 1`)
      .bind(new Date(now).toISOString().slice(0, 7), method),
  ]);
  return token;
}

export async function endSession(req: Request): Promise<void> {
  const token = sessionToken(req);
  const d = await db();
  if (!token || !d) return;
  await d.prepare(`DELETE FROM account_session WHERE token = ?`).bind(await sha256(token)).run();
}

/** The account for this email (made on first sign-in); with Google, its id and name are kept too. */
export async function accountFor(email: string, google?: { sub: string; name: string | null }): Promise<Account> {
  const d = await db();
  if (!d) throw new Error("no database");
  const now = new Date().toISOString();
  if (google) {
    const byGoogle = await d.prepare(`SELECT id, email, name FROM account WHERE google = ?`).bind(google.sub).first<Account>();
    if (byGoogle) return byGoogle;
  }
  const found = await d.prepare(`SELECT id, email, name FROM account WHERE email = ?`).bind(email).first<Account>();
  if (found) {
    if (google) {
      await d.prepare(`UPDATE account SET google = ?, name = COALESCE(name, ?) WHERE id = ?`).bind(google.sub, google.name, found.id).run();
      return { ...found, name: found.name ?? google.name };
    }
    return found;
  }
  const id = randomToken(12);
  await d
    .prepare(`INSERT INTO account (id, email, name, google, created, seen) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, email, google?.name ?? null, google?.sub ?? null, now, now)
    .run();
  return { id, email, name: google?.name ?? null };
}

export type CodeAsk = "ok" | "wait" | "no-db";

/** Stores a new code for the email; "wait" when one went out less than a minute ago. */
export async function newLoginCode(email: string, code: string): Promise<CodeAsk> {
  const d = await db();
  if (!d) return "no-db";
  const now = Date.now();
  const prev = await d.prepare(`SELECT sent FROM login_code WHERE email = ?`).bind(email).first<{ sent: number }>();
  if (prev && now - prev.sent < CODE_GAP_S * 1000) return "wait";
  await d.batch([
    d
      .prepare(`INSERT OR REPLACE INTO login_code (email, code, expires, sent, tries) VALUES (?, ?, ?, ?, 0)`)
      .bind(email, await sha256(`${email}:${code}`), now + CODE_MIN * 60_000, now),
    d.prepare(`DELETE FROM login_code WHERE expires < ?`).bind(now),
  ]);
  return "ok";
}

export type CodeCheck = "ok" | "wrong" | "expired";

/** Checks a typed code; a right one is used up, and too many wrong ones end it. */
export async function checkLoginCode(email: string, code: string): Promise<CodeCheck> {
  const d = await db();
  if (!d) return "expired";
  const row = await d.prepare(`SELECT code, expires, tries FROM login_code WHERE email = ?`).bind(email).first<{ code: string; expires: number; tries: number }>();
  if (!row || row.expires < Date.now() || row.tries >= CODE_TRIES) return "expired";
  if (row.code !== (await sha256(`${email}:${code}`))) {
    await d.prepare(`UPDATE login_code SET tries = tries + 1 WHERE email = ?`).bind(email).run();
    return row.tries + 1 >= CODE_TRIES ? "expired" : "wrong";
  }
  await d.prepare(`DELETE FROM login_code WHERE email = ?`).bind(email).run();
  return "ok";
}

/** A same-site path to come back to after signing in ("/trasa/x"), never another site. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw.slice(0, 300);
}

export interface AccountMonth {
  month: string;
  /** Accounts made this month. */
  created: number;
  /** Sign-ins this month (a new account's first one included), by way. */
  google: number;
  email: number;
}

/** Accounts for /statistiky: the total and each month, newest first; null without the database. */
export async function accountStats(): Promise<{ total: number; months: AccountMonth[] } | null> {
  const d = await db().catch(() => null);
  if (!d) return null;
  const [made, signins] = await Promise.all([
    d.prepare(`SELECT substr(created, 1, 7) AS month, COUNT(*) AS n FROM account GROUP BY month`).all<{ month: string; n: number }>(),
    d.prepare(`SELECT month, method, n FROM signin_month`).all<{ month: string; method: string; n: number }>(),
  ]);
  const months = new Map<string, AccountMonth>();
  const at = (month: string) => {
    let m = months.get(month);
    if (!m) months.set(month, (m = { month, created: 0, google: 0, email: 0 }));
    return m;
  };
  let total = 0;
  for (const r of made.results) {
    at(r.month).created += r.n;
    total += r.n;
  }
  for (const r of signins.results) if (r.method === "google" || r.method === "email") at(r.month)[r.method] += r.n;
  return { total, months: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)) };
}
