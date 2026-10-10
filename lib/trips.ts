import tripIndex from "@/data/trips/index.json";
import closureRules from "@/data/closure-rules.json";
import feeRules from "@/data/fee-rules.json";
import driveTimes from "@/data/drive-times.json";
import { tripDetailLoaders } from "@/data/trips/details.generated";
import type {
  ClosureRule,
  ClosureRules,
  DriveTimes,
  FeeRules,
  GeoPoint,
  Town,
  TripDetail,
  TripIndex,
  TripSummary,
} from "@/lib/tripSchema";

// Static trip data written by the weekly pipeline (pipeline/, docs/TRIP-DATA.md).
// Everything here is bundled at build time: no database, no network.

const INDEX = tripIndex as unknown as TripIndex;
const CLOSURE_RULES = closureRules as unknown as ClosureRules;
const FEE_RULES = feeRules as unknown as FeeRules;
const DRIVE = driveTimes as unknown as DriveTimes;

export function getTripIndex(): TripIndex {
  return INDEX;
}

export function getAllTrips(): TripSummary[] {
  return INDEX.trips;
}

export function getTripSummary(slug: string): TripSummary | null {
  return INDEX.trips.find((t) => t.slug === slug) ?? null;
}

/** Full trip with path, alternatives and POIs, or null for an unknown slug. */
export async function getTrip(slug: string): Promise<TripDetail | null> {
  const load = Object.hasOwn(tripDetailLoaders, slug) ? tripDetailLoaders[slug] : undefined;
  return load ? load() : null;
}

export function getClosureRules(): ClosureRule[] {
  return CLOSURE_RULES.rules;
}

/** The closure rules that cover a trip. Empty means "unverified", never "open". */
export function closureRulesFor(trip: Pick<TripSummary, "closure_rule_ids">): ClosureRule[] {
  return CLOSURE_RULES.rules.filter((r) => trip.closure_rule_ids.includes(r.id));
}

export function getFeeRules(): FeeRules["rules"] {
  return FEE_RULES.rules;
}

export function getDriveTimes(): DriveTimes {
  return DRIVE;
}

/** Precomputed car time from a town to a trip's parking, or null when unknown. */
export function driveMinutes(townId: string, slug: string): number | null {
  const ti = DRIVE.towns.findIndex((t) => t.id === townId);
  const si = DRIVE.slugs.indexOf(slug);
  if (ti < 0 || si < 0) return null;
  return DRIVE.minutes[ti]?.[si] ?? null;
}

/** The precomputed town closest to a point (straight line), e.g. to map GPS to a drive-table row. */
export function nearestTown(p: GeoPoint): Town | null {
  let best: Town | null = null;
  let bestD = Infinity;
  const k = Math.cos((p.lat * Math.PI) / 180);
  for (const t of DRIVE.towns) {
    const d = (t.location.lat - p.lat) ** 2 + ((t.location.lon - p.lon) * k) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** Where the drive ends: the trip's parking, else its start. */
export function tripDriveDestination(trip: TripSummary): GeoPoint {
  return trip.parking?.location ?? trip.start.location;
}
