import { getDb } from "@/lib/d1";

// The free OpenRouteService key allows 2,000 routes a day for the whole site.
// The per-minute limiter (lib/routeGuard.ts) slows one visitor down, but a
// script stepping through new places all day would still spend it in a few
// hours, and then every visitor gets estimates. So every call to the router is
// counted per UTC day (when ORS resets) in the site's database, and past
// DAILY_BUDGET the routes answer "busy" and pages fall back to their
// straight-line estimate until midnight. Without the database (local dev)
// nothing is counted.

/** A little under the key's 2,000, so a few calls in flight can't go over. */
export const DAILY_BUDGET = 1800;

const SCHEMA = `CREATE TABLE IF NOT EXISTS ors_day (day TEXT PRIMARY KEY, n INTEGER NOT NULL) WITHOUT ROWID`;
let ready: Promise<unknown> | null = null;
/** Once a day is spent, this server stops asking the database until the day changes. */
let spentDay = "";

const utcDay = () => new Date().toISOString().slice(0, 10);

/** Counts one router call; false when today's budget is gone (the call must not be made). */
export async function spendOrsCall(): Promise<boolean> {
  const day = utcDay();
  if (spentDay === day) return false;
  try {
    const db = await getDb();
    if (!db) return true;
    ready ??= db
      .prepare(SCHEMA)
      .run()
      .catch((err) => {
        ready = null;
        throw err;
      });
    await ready;
    const row = await db
      .prepare(`INSERT INTO ors_day (day, n) VALUES (?1, 1) ON CONFLICT (day) DO UPDATE SET n = n + 1 RETURNING n`)
      .bind(day)
      .first<{ n: number }>();
    if (row && row.n > DAILY_BUDGET) {
      spentDay = day;
      return false;
    }
    // Yesterday's rows are never read again.
    if (row?.n === 1) await db.prepare(`DELETE FROM ors_day WHERE day < ?1`).bind(day).run();
    return true;
  } catch (err) {
    // The counter being down must not cost the route.
    console.warn("[ors] budget not counted:", err);
    return true;
  }
}
