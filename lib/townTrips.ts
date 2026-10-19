import { getAllTrails, getTownDrives } from "@/lib/tripFiles";
import { getTowns } from "@/lib/trips";
import type { Town } from "@/lib/tripSchema";
import type { TrailDetail } from "@/lib/types";

/** How far a town page reaches by car, in bands people think in. */
export const TOWN_BANDS = [
  { maxMin: 30, label: "Do pol hodiny autom" },
  { maxMin: 60, label: "Do hodiny autom" },
  { maxMin: 90, label: "Do hodiny a pol autom" },
] as const;

/** Trips shown per band; the rest are one tap away on the map. */
const PER_BAND = 6;

/** The biggest towns, shown first in the town list. */
export const BIG_TOWNS = ["bratislava", "kosice", "presov", "zilina", "nitra", "banska-bystrica", "trnava", "trencin", "martin", "poprad"];

export interface TownTrip {
  detail: TrailDetail;
  carMin: number;
}

export interface TownTrips {
  town: Town;
  bands: { label: string; count: number; trips: TownTrip[] }[];
  /** Trips within the last band. */
  total: number;
  kids: number;
}

export function getTown(id: string): Town | null {
  return getTowns().find((t) => t.id === id) ?? null;
}

/** The best known trips within each band of driving from a town (main routes, best known first). */
export async function getTownTrips(id: string): Promise<TownTrips | null> {
  const town = getTown(id);
  if (!town) return null;
  const [trails, minutes] = await Promise.all([getAllTrails(), getTownDrives(id)]);
  const reach: TownTrip[] = [];
  for (const detail of trails) {
    const carMin = minutes[detail.trail.slug];
    if (carMin != null && carMin <= TOWN_BANDS[TOWN_BANDS.length - 1].maxMin) reach.push({ detail, carMin });
  }
  let from = 0;
  const bands = TOWN_BANDS.map(({ maxMin, label }) => {
    const inBand = reach.filter((t) => t.carMin > from && t.carMin <= maxMin);
    from = maxMin;
    return { label, count: inBand.length, trips: inBand.slice(0, PER_BAND) };
  });
  return { town, bands, total: reach.length, kids: reach.filter((t) => t.detail.trail.family_friendly).length };
}
