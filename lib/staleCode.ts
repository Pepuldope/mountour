// Telling "this page's code is from an older deploy" apart from other errors
// (components/StaleCodeReload.tsx).

/** At most one automatic reload per tab in this long. */
export const RELOAD_GUARD_MS = 60_000;
const KEY = "turuj-stale-reload";

/** A code file the page asked for is gone: webpack/Turbopack chunk errors and failed dynamic imports. */
export function isStaleCodeError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { name, message } = err as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  const text = typeof message === "string" ? message : "";
  return (
    /Loading (CSS )?chunk [\w/.-]+ failed/i.test(text) ||
    /Failed to (fetch|load) dynamically imported module/i.test(text) ||
    /error loading dynamically imported module/i.test(text) ||
    /Importing a module script failed/i.test(text)
  );
}

interface StoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** True (and remembers now) unless this tab already reloaded within RELOAD_GUARD_MS. */
export function mayReloadNow(store: StoreLike, now: number): boolean {
  const last = Number(store.getItem(KEY));
  if (Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_MS) return false;
  store.setItem(KEY, String(now));
  return true;
}
