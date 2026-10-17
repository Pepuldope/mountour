import { getDb } from "@/lib/d1";
import type { D1Like } from "@/lib/d1";

// Visit days live in the site's Cloudflare D1 database (lib/d1.ts). No other
// account, key or secret. Without the database every function here quietly
// does nothing.

export interface MonthStats {
  month: string;
  visitors: number;
  visitors_2plus_days: number;
  visitors_4plus_days: number;
  avg_days: number;
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
const salts = new Map<string, string>();
/** /statistiky reads every row of the month; a few minutes old is fine. */
const STATS_TTL_MS = 5 * 60_000;
let statsMemo: { at: number; rows: MonthStats[] } | null = null;

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
    // OR IGNORE: a month is closed once. A visit that slipped in just after
    // midnight on another server must not replace the month's totals.
    db.prepare(`INSERT OR IGNORE INTO visit_month ${MONTH_TOTALS} WHERE month < ?1 GROUP BY month`).bind(currentMonth),
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
  const known = salts.get(month);
  if (known) return known;
  const db = await getDb();
  if (!db) return null;
  await prepared(db);
  await closeOutFinishedMonths(db, month);
  // A month already closed out gets no new key (and so no new rows).
  const closed = await db.prepare(`SELECT 1 FROM visit_month WHERE month = ?1`).bind(month).first();
  if (closed) return null;
  await db.prepare(`INSERT OR IGNORE INTO visit_salt (month, salt) VALUES (?1, ?2)`).bind(month, randomHex(32)).run();
  const row = await db.prepare(`SELECT salt FROM visit_salt WHERE month = ?1`).bind(month).first<{ salt: string }>();
  if (!row) return null;
  salts.clear();
  salts.set(month, row.salt);
  return row.salt;
}

export async function recordVisitDay(visitor: string, day: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.prepare(`INSERT OR IGNORE INTO visit_day (visitor, day) VALUES (?1, ?2)`).bind(visitor, day).run();
}

/** Every month, newest first: finished months from visit_month, the current one live. */
export async function monthlyStats(): Promise<MonthStats[] | null> {
  if (statsMemo && Date.now() - statsMemo.at < STATS_TTL_MS) return statsMemo.rows;
  const db = await getDb();
  if (!db) return null;
  await prepared(db);
  const { results } = await db
    .prepare(
      `${MONTH_TOTALS} WHERE month NOT IN (SELECT month FROM visit_month) GROUP BY month
       UNION ALL
       SELECT month, visitors, visitors_2plus_days, visitors_4plus_days, avg_days FROM visit_month
       ORDER BY month DESC`,
    )
    .all<MonthStats>();
  statsMemo = { at: Date.now(), rows: results };
  return results;
}
