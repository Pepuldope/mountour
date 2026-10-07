// Shared domain types for MounTour. Mirrors supabase/migrations/0001_init.sql.

export type Difficulty = "lahka" | "stredna" | "tazka";
export type ClosureKind = "rocna" | "jednorazova";
export type PoiKind =
  | "vyhliadka"
  | "chata"
  | "obcerstvenie"
  | "pramen"
  | "hrad"
  | "ihrisko"
  | "utulna";

export interface LatLng {
  lat: number;
  lon: number;
}

export interface BBox {
  /** south-west corner */
  sw: LatLng;
  /** north-east corner */
  ne: LatLng;
}

export interface Trail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  distance_m: number;
  ascent_m: number;
  difficulty: Difficulty;
  duration_min: number;
  family_friendly: boolean;
  gpx_path: string | null;
  bbox: BBox | null;
  created_at: string;
}

export interface Trailhead {
  id: string;
  trail_id: string;
  name: string;
  location: LatLng;
  is_primary: boolean;
}

export interface ParkingLot {
  id: string;
  trailhead_id: string;
  name: string;
  location: LatLng;
  surface_type: string | null;
  note: string | null;
  verified_on: string | null;
}

export interface Closure {
  id: string;
  trail_id: string;
  kind: ClosureKind;
  starts_on: string; // ISO date, YYYY-MM-DD
  ends_on: string; // ISO date, YYYY-MM-DD
  reason: string;
  source_url: string;
  verified_on: string;
}

export interface Poi {
  id: string;
  trail_id: string | null;
  kind: PoiKind;
  name: string;
  location: LatLng;
  note: string | null;
}

/** Everything the trip sheet needs for one trail, assembled in one place. */
export interface TrailDetail {
  trail: Trail;
  trailheads: Trailhead[];
  parkingLots: ParkingLot[];
  closures: Closure[];
  pois: Poi[];
}
