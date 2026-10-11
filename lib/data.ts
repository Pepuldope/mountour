import { approachMin } from "@/lib/dayPlan";
import { distanceAlongM } from "@/lib/geo";
import { trailJoin } from "@/lib/trailJoin";
import type { TrailJoin } from "@/lib/trailJoin";
import { closureRulesFor } from "@/lib/trips";
import type { Parking, TransitStop as TripStop, TripDetail, TripSummary } from "@/lib/tripSchema";
import type { Closure, ParkingLot, TrailDetail, Trail, LatLng, TransitStop } from "@/lib/types";

// The pages still speak the older TrailDetail shape; this adapts the static
// trip data (lib/trips.ts, docs/TRIP-DATA.md) to it. New code should use
// lib/trips.ts directly.

function parkingLot(p: Parking, slug: string, i: number, join: TrailJoin | null): ParkingLot {
  const fee = p.fee === true ? ", spoplatnené" : p.fee === false ? ", bezplatné" : "";
  return {
    id: `${slug}:parking:${i}`,
    trailhead_id: `${slug}:start`,
    name: p.name ?? "Parkovisko",
    location: p.location,
    surface_type: null,
    note: join ? `${join.walk_m} m od trasy${fee}. Zdroj: OpenStreetMap.` : `${p.walk_m} m od začiatku trasy${fee}. Zdroj: OpenStreetMap.`,
    verified_on: null,
    walk_m: p.walk_m,
    fee: p.fee,
    join,
  };
}

function transitStop(s: TripStop, slug: string, i: number, join: TrailJoin | null): TransitStop {
  return {
    id: `${slug}:stop:${i}`,
    trailhead_id: `${slug}:start`,
    name: s.name,
    mode: s.mode,
    location: s.location,
    distance_m: s.walk_m,
    join,
  };
}

function toTrail(t: TripSummary): Trail {
  const [w, s, e, n] = t.bbox;
  return {
    id: t.slug,
    name: t.name,
    slug: t.slug,
    description: t.description,
    distance_m: t.distance_m,
    ascent_m: t.ascent_m,
    difficulty: t.difficulty,
    duration_min: t.duration_min,
    family_friendly: t.family_friendly,
    gpx_path: t.gpx_url.replace(/^\//, ""),
    marking: t.marking[0] ?? null,
    goal: t.destination.kind,
    region_name: t.region_name,
    bbox: { sw: { lat: s, lon: w }, ne: { lat: n, lon: e } },
    created_at: "",
  };
}

/** A trip from the files or the database, in the shape the pages use. */
export function trailDetailFrom(t: TripSummary | TripDetail): TrailDetail {
  const d = "path" in t ? t : null;
  const parking = [t.parking, ...(d?.parking_alternatives ?? [])].filter((p): p is Parking => p != null);
  const stops = [t.transit, ...(d?.transit_alternatives ?? [])].filter((s): s is TripStop => s != null);
  // Parked or got off up the trail: join it at its nearest point (needs the path).
  const joinOf = (at: LatLng, walkM: number) => (d ? trailJoin(d.path, at, walkM, d.route === "okruh") : null);
  const closures: Closure[] = closureRulesFor(t).map((r) => ({
    id: r.id,
    trail_id: t.slug,
    kind: r.kind,
    starts_on: r.starts_on,
    ends_on: r.ends_on,
    reason: r.reason,
    source_url: r.source_url,
    verified_on: r.verified_on,
  }));
  return {
    trail: toTrail(t),
    trailheads: [{ id: `${t.slug}:start`, trail_id: t.slug, name: t.start.name, location: t.start.location, is_primary: true }],
    parkingLots: parking.map((p, i) => parkingLot(p, t.slug, i, joinOf(p.location, p.walk_m))),
    transitStops: stops.map((s, i) => transitStop(s, t.slug, i, joinOf(s.location, s.walk_m))),
    closures,
    fees: t.fees,
    pois: (d?.pois ?? [])
      .map((p, i) => ({
        id: `${t.slug}:poi:${i}`,
        trail_id: t.slug,
        kind: p.kind,
        name: p.name,
        location: p.location,
        note: null,
        // Out-and-back paths stop at the goal, so this is the way up.
        along_m: Math.round(distanceAlongM(d!.path, p.location)),
      }))
      .sort((a, b) => a.along_m - b.along_m),
  };
}

export interface TrailSearchFilters {
  /** Maximum time budget, in hours. Trails longer than this are excluded. */
  maxHours?: number;
  /** Require family_friendly = true. */
  withKids?: boolean;
}

export function filterTrails(trails: TrailDetail[], filters: TrailSearchFilters): TrailDetail[] {
  return trails.filter(({ trail }) => {
    if (filters.maxHours != null && trail.duration_min > filters.maxHours * 60) return false;
    if (filters.withKids && !trail.family_friendly) return false;
    return true;
  });
}

export function trailCenter(trail: Trail): LatLng | null {
  if (!trail.bbox) return null;
  return {
    lat: (trail.bbox.sw.lat + trail.bbox.ne.lat) / 2,
    lon: (trail.bbox.sw.lon + trail.bbox.ne.lon) / 2,
  };
}

export function primaryTrailhead(detail: TrailDetail) {
  return detail.trailheads.find((t) => t.is_primary) ?? detail.trailheads[0] ?? null;
}

/** Walking time between the default parking and the trail start, one way (0 without parking). */
export function defaultApproachMin(detail: TrailDetail): number {
  return approachMin(detail.parkingLots[0]?.walk_m ?? 0);
}

/** The public-transport stop closest to the trail start, or null. */
export function nearestStop(detail: TrailDetail): TransitStop | null {
  return [...detail.transitStops].sort((a, b) => a.distance_m - b.distance_m)[0] ?? null;
}

/** Where the drive ends: the nearest parking lot, else the trailhead itself. */
export function driveDestination(detail: TrailDetail): LatLng | null {
  return detail.parkingLots[0]?.location ?? primaryTrailhead(detail)?.location ?? trailCenter(detail.trail);
}

/** Where sunrise/sunset are computed for a trail. */
export function sunLocation(detail: TrailDetail): LatLng | null {
  return detail.parkingLots[0]?.location ?? trailCenter(detail.trail);
}
