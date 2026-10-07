import fixtures from "@/data/fixtures/trails.json";
import { getSupabaseClient } from "@/lib/supabase";
import type { TrailDetail, Trail, LatLng } from "@/lib/types";

// Type assertion: the fixture file is hand-maintained to match TrailDetail[].
const FIXTURE_TRAILS = fixtures as unknown as TrailDetail[];

/**
 * Loads every trail's full detail. Tries Supabase first; if it isn't
 * configured (no env vars) or the query fails for any reason, falls back to
 * the local JSON fixture so `npm run dev` works with zero cloud setup.
 *
 * NOTE: this project's live Supabase schema uses PostGIS `geography` columns.
 * Reading those back over supabase-js requires either a `st_asgeojson` RPC/view
 * or client-side WKB parsing — neither is wired up here because no live
 * Supabase project exists yet to develop against. Once one does, replace the
 * body of `fetchFromSupabase` with real queries against `trail`, `trailhead`,
 * `parking_lot`, `closure` and `poi`, decoding `location`/`bbox` via a
 * `st_asgeojson(...)` select or a Postgres view that already exposes lat/lon.
 */
async function fetchFromSupabase(): Promise<TrailDetail[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from("trail").select("id").limit(1);
    if (error || !data) return null;
    // Live PostGIS decoding is not implemented yet (see note above) — until
    // it is, treat "Supabase reachable" as "not yet able to serve full trail
    // detail" and fall back to the fixture rather than returning partial data.
    return null;
  } catch {
    return null;
  }
}

export async function getAllTrails(): Promise<TrailDetail[]> {
  const fromDb = await fetchFromSupabase();
  return fromDb ?? FIXTURE_TRAILS;
}

export async function getTrailBySlug(slug: string): Promise<TrailDetail | null> {
  const all = await getAllTrails();
  return all.find((t) => t.trail.slug === slug) ?? null;
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
