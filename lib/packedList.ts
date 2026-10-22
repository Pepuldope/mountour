import type { TripList } from "@/lib/tripSchema";

/** Marks a field the trip doesn't have (scripts/pack-list.mjs MISSING). */
const MISSING = "§";

/** public/data/home-list.json: trips/list.json packed by scripts/pack-list.mjs. */
export interface PackedList {
  version: number;
  generated_at: string;
  cols: string[];
  dict: Record<string, unknown[]>;
  data: unknown[][];
}

/** The trip list back from its packed copy: the same trips and fields as list.json (coordinates to ~1 m). */
export function unpackList(p: PackedList): TripList {
  const n = p.data[0]?.length ?? 0;
  const trips: Record<string, unknown>[] = Array.from({ length: n }, () => ({}));
  p.cols.forEach((col, c) => {
    const table = p.dict[col];
    const column = p.data[c];
    const path = col.split(".");
    for (let i = 0; i < n; i++) {
      const value = table ? table[column[i] as number] : column[i];
      if (value === MISSING) continue;
      let at = trips[i];
      for (let k = 0; k < path.length - 1; k++) at = (at[path[k]] ??= {}) as Record<string, unknown>;
      at[path[path.length - 1]] = value;
    }
  });
  return { version: p.version, generated_at: p.generated_at, trips } as unknown as TripList;
}
