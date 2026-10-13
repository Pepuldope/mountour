import type { TrailJoin } from "@/lib/trailJoin";
import type { DestinationKind, Fee, WalkLine } from "@/lib/tripSchema";

// Shared domain types for MounTour. Mirrors supabase/migrations/0001_init.sql.

export type Difficulty = "lahka" | "stredna" | "tazka";
export type ClosureKind = "rocna" | "jednorazova";
export type TransitMode = "autobus" | "elektricka" | "vlak";
export type PoiKind =
  | "vyhliadka"
  | "chata"
  | "obcerstvenie"
  | "pramen"
  | "hrad"
  | "ihrisko"
  | "utulna";

/** KST waymark colour of the route (the stripe on the painted square). */
export type TrailMarking = "red" | "blue" | "green" | "yellow" | "black";

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
  /** What the walk is for (peak, waterfall...): colour and icon in lists. */
  goal?: DestinationKind;
  /** "Malá Fatra", "Tatry"... */
  region_name?: string;
  /** Where the goal is (peak, waterfall...): its dot on the home map. */
  goal_location?: LatLng;
  /** Popularity score from the pipeline; higher = better known. */
  rank?: number;
  /** Main waymark colour; optional until the OSM pipeline fills it. */
  marking?: TrailMarking | null;
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
  /** Straight-line walk from the parking to the trail start, metres. */
  walk_m: number;
  /** true = paid, false = free, null = unknown. */
  fee: boolean | null;
  verified_on: string | null;
  /** Parked up the trail: where the walk joins it (null = at the start). */
  join: TrailJoin | null;
  /** The walk to the trail on paths, worked out weekly; null = ask the router. */
  walk: WalkLine | null;
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

/** Public-transport stop near a trailhead (OpenStreetMap). */
export interface TransitStop {
  id: string;
  trailhead_id: string;
  name: string;
  mode: TransitMode;
  location: LatLng;
  /** Straight-line distance to the trailhead, in metres. */
  distance_m: number;
  /** A stop up the trail: where the walk joins it (null = at the start). */
  join: TrailJoin | null;
  /** As on ParkingLot. */
  walk: WalkLine | null;
}

export interface Poi {
  id: string;
  trail_id: string | null;
  kind: PoiKind;
  name: string;
  location: LatLng;
  note: string | null;
  /** Metres from the trail start along the walk, when the path is known. */
  along_m: number | null;
}

/** Everything the trip sheet needs for one trail, assembled in one place. */
export interface TrailDetail {
  trail: Trail;
  trailheads: Trailhead[];
  parkingLots: ParkingLot[];
  transitStops: TransitStop[];
  closures: Closure[];
  /** Entry fees (vstupné). Empty = none known, not "free". */
  fees: Fee[];
  pois: Poi[];
}
