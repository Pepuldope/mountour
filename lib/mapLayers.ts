// Single source of truth for the map: base style, trail colours, and the URLs a
// saved trip needs offline (the map component and lib/tiles.ts both use these).
//
// Base map: OpenFreeMap vector tiles (free, no key, commercial use allowed).
// Marked trails: our own lines in the real KST colours, not a third-party overlay.
import type { TrailMarking } from "@/lib/types";

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** OpenFreeMap tiles stop at z14; MapLibre overzooms past that. */
export const VECTOR_MAX_ZOOM = 14;

/** KST colours as map line colours (brand tokens --trail-*). */
export const MARKING_COLOR: Record<TrailMarking, string> = {
  red: "#c4122f",
  blue: "#1d4fa0",
  green: "#1e7a3e",
  yellow: "#f2c200",
  black: "#1f2430",
};

/** Trails without a known marking: the brand's dusk blue. */
export const DEFAULT_TRACK_COLOR = "#2b4c9b";

export const MARKING_LABEL: Record<TrailMarking, string> = {
  red: "po červenej",
  blue: "po modrej",
  green: "po zelenej",
  yellow: "po žltej",
  black: "po čiernej",
};

export function trackColor(marking: TrailMarking | null | undefined): string {
  return marking ? MARKING_COLOR[marking] : DEFAULT_TRACK_COLOR;
}
