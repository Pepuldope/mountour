import { getCloudflareContext } from "@opennextjs/cloudflare";

// Visit days live in Cloudflare D1 (free, bound as VISITS_DB in
// wrangler.jsonc, created automatically on the first deploy). No other
// account, key or secret. Outside Cloudflare (local dev, Vercel) there is no
// database and every function here quietly does nothing.

/** The slice of the D1 API used here. */
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}
interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
}

export interface MonthStats {
  month: string;
  visitors: number;
  visitors_2plus_days: number;
  visitors_4plus_days: number;
  avg_days: number;
}

async function getDb(): Promise<D1Like | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as Record<string, unknown>).VISITS_DB as D1Like | undefined) ?? null;
  } catch {
    return null;
  }
}

const SCHEMA = [
  // One row per visitor per day; visitor = hash(month salt, IP, browser).
  `CREATE TABLE IF NOT EXISTS visit_day (visitor TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (visitor, day)) WITHOUT ROWID`,
  // A random key per month, created here and deleted when the month is over,
  // so old hashes can never be recomputed, not even by us.
  `CREATE TABLE IF NOT EXISTS visit_salt (month TEXT PRIMARY KEY, salt TEXT NOT NULL)`,
  // Totals of finished months; the raw rows behind them are deleted.
  `CREATE TABLE IF NOT EXISTS visit_month (month TEXT PRIMARY KEY, visitors INTEGER NOT NULL, visitors_2plus_days INTEGER NOT NULL, visitors_4plus_days INTEGER NOT NULL, avg_days REAL NOT NULL)`,
];

const MONTH_TOTALS = `
  SELECT month,
         COUNT(*) AS visitors,
         SUM(days >= 2) AS visitors_2plus_days,
         SUM(days >= 4) AS visitors_4plus_days,
         ROUND(AVG(days), 2) AS avg_days
  FROM (SELECT substr(day, 1, 7) AS month, visitor, COUNT(*) AS days FROM visit_day GROUP BY 1, 2)`;

let ready: Promise<void> | null = null;
let lastCloseOut = "";

async function prepared(db: D1Like): Promise<void> {
  ready ??= db
    .batch(SCHEMA.map((sql) => db.prepare(sql)))
    .then(() => undefined)
    .catch((err) => {
      ready = null;
      throw err;
    });
  return ready;
}

/** Moves finished months into visit_month and deletes their raw rows and salts. */
async function closeOutFinishedMonths(db: D1Like, currentMonth: string): Promise<void> {
  if (lastCloseOut === currentMonth) return;
  await db.batch([
    db.prepare(`INSERT OR REPLACE INTO visit_month ${MONTH_TOTALS} WHERE month < ?1 GROUP BY month`).bind(currentMonth),
    db.prepare(`DELETE FROM visit_day WHERE substr(day, 1, 7) < ?1`).bind(currentMonth),
    db.prepare(`DELETE FROM visit_salt WHERE month < ?1`).bind(currentMonth),
  ]);
  lastCloseOut = currentMonth;
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The secret key for `month`, created on first use. Returns null when there is
 * no database, so the caller can skip counting.
 */
export async function monthSalt(month: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  await prepared(db);
  await closeOutFinishedMonths(db, month);
  await db.prepare(`INSERT OR IGNORE INTO visit_salt (month, salt) VALUES (?1, ?2)`).bind(month, randomHex(32)).run();
  const row = await db.prepare(`SELECT salt FROM visit_salt WHERE month = ?1`).bind(month).first<{ salt: string }>();
  return row?.salt ?? null;
}

export async function recordVisitDay(visitor: string, day: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.prepare(`INSERT OR IGNORE INTO visit_day (visitor, day) VALUES (?1, ?2)`).bind(visitor, day).run();
}

/** Every month, newest first: finished months from visit_month, the current one live. */
export async function monthlyStats(): Promise<MonthStats[] | null> {
  const db = await getDb();
  if (!db) return null;
  await prepared(db);
  const { results } = await db
    .prepare(
      `${MONTH_TOTALS} GROUP BY month
       UNION ALL
       SELECT month, visitors, visitors_2plus_days, visitors_4plus_days, avg_days FROM visit_month
       WHERE month NOT IN (SELECT DISTINCT substr(day, 1, 7) FROM visit_day)
       ORDER BY month DESC`,
    )
    .all<MonthStats>();
  return results;
}
