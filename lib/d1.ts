import { getCloudflareContext } from "@opennextjs/cloudflare";

// The site's one Cloudflare D1 database (free, bound as VISITS_DB in
// wrangler.jsonc, created automatically on the first deploy): the visit
// counter's tables and the trip tables loaded by .github/workflows/db.yml.
// Outside Cloudflare (local dev, Vercel) there is no database: getDb() is null.

/** The slice of the D1 API the site uses. */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
}

export async function getDb(): Promise<D1Like | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as Record<string, unknown>).VISITS_DB as D1Like | undefined) ?? null;
  } catch {
    return null;
  }
}
