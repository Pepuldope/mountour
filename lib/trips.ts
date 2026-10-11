import closureRules from "@/data/closure-rules.json";
import feeRules from "@/data/fee-rules.json";
import townsFile from "@/data/towns.json";
import type { ClosureRule, ClosureRules, FeeRules, GeoPoint, Town, Towns, TripList, TripSummary } from "@/lib/tripSchema";

// The small, hand-kept or rarely changing trip data, bundled at build time and
// safe for the browser. The trips themselves (thousands) are static files in
// public/data, read by lib/tripFiles.ts (server) and fetched by the home page.

const CLOSURE_RULES = closureRules as unknown as ClosureRules;
const FEE_RULES = feeRules as unknown as FeeRules;
const TOWNS = townsFile as unknown as Towns;

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

/** The ~140 towns the weekly drive table starts from. */
export function getTowns(): Town[] {
  return TOWNS.towns;
}

/** The precomputed town closest to a point (straight line), e.g. to map GPS to a drive-table row. */
export function nearestTown(p: GeoPoint): Town | null {
  let best: Town | null = null;
  let bestD = Infinity;
  const k = Math.cos((p.lat * Math.PI) / 180);
  for (const t of TOWNS.towns) {
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

/** A trip from the home list (public/data/trips/list.json) in the full summary shape. */
export function summaryFromList(t: TripList["trips"][number]): TripSummary {
  const noOsm = <T extends object>(p: T | null): (T & { osm: null }) | null => (p ? { ...p, osm: null } : null);
  return {
    ...t,
    description: "",
    gpx_url: `/gpx/${t.slug}.gpx`,
    marked_share: 1,
    curated: false,
    protected_area: null,
    max_ele_m: null,
    destination: { ...t.destination, osm: null },
    start: { ...t.start, osm: null },
    parking: noOsm(t.parking),
    transit: noOsm(t.transit),
  };
}
