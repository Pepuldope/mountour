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
 * Reads the `trail_detail` view (supabase/migrations/0003_trail_detail_view.sql),
 * which already decodes PostGIS geography into {lat, lon} and returns each row
 * shaped like TrailDetail.
 */
async function fetchFromSupabase(): Promise<TrailDetail[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from("trail_detail").select("detail").order("slug");
    if (error || !data) {
      console.warn("[data] Supabase query failed, using fixture:", error?.message);
      return null;
    }
    return data.map((row) => row.detail as TrailDetail);
  } catch (err) {
    console.warn("[data] Supabase unreachable, using fixture:", err);
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
