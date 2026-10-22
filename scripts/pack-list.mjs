// The home page's copy of the trip list (npm runs it in "prebuild"; Peter 2026-10-22):
// public/data/trips/list.json (1.7 MB) packed into public/data/home-list.json, about a
// third of the size to download and to read on a slow phone. Every field is kept, so
// new list fields need no change here; lib/packedList.ts unpacks it in the browser, and
// lib/packedList.test.ts checks that unpacking gives the list back.
import { readFileSync, writeFileSync } from "node:fs";

/** Marks a field the trip doesn't have (a real null stays null). */
export const MISSING = "§";
/** Columns with fewer distinct values than this become a small table plus an index per trip. */
const DICT_MAX = 300;

/** Coordinates to 5 decimals (about 1 m); the trip page reads its own file at full precision. */
const round = (v) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1e5) / 1e5 : v);
const COORD = /(^|\.)(lat|lon)$|^bbox$/;

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, path, out);
    else out[path] = v;
  }
  return out;
}

/**
 * { version, generated_at, cols: ["slug", "destination.location.lat", …], dict: { col: [values] },
 *   data: [one array per column, one entry per trip] }. A column in `dict` holds indexes into its table.
 */
export function packList(list) {
  const rows = list.trips.map((t) => flatten(t, "", {}));
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  /** @type {Record<string, unknown[]>} */
  const dict = {};
  const data = cols.map((c) => {
    const values = rows.map((r) => (c in r ? (COORD.test(c) ? (Array.isArray(r[c]) ? r[c].map(round) : round(r[c])) : r[c]) : MISSING));
    const distinct = [...new Set(values.map((v) => JSON.stringify(v)))];
    if (distinct.length >= DICT_MAX || distinct.length >= rows.length / 5) return values;
    const at = new Map(distinct.map((v, i) => [v, i]));
    dict[c] = distinct.map((v) => JSON.parse(v));
    return values.map((v) => at.get(JSON.stringify(v)));
  });
  return { version: list.version, generated_at: list.generated_at, cols, dict, data };
}

if (process.argv[1]?.endsWith("pack-list.mjs")) {
  const raw = readFileSync("public/data/trips/list.json", "utf8");
  const out = JSON.stringify(packList(JSON.parse(raw)));
  writeFileSync("public/data/home-list.json", out);
  console.log(`Home list: ${(raw.length / 1e6).toFixed(2)} MB -> ${(out.length / 1e6).toFixed(2)} MB`);
}
