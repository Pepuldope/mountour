// Colours that carry meaning on the map and in lists, kept in one place so the
// visual identity work can swap them without touching the features.
// Values decided with Peter in the "Feel Lab" prototype (2026-10-11, strategy/12-feel/).
import type { DestinationKind, PoiKind } from "@/lib/tripSchema";

/**
 * Trail popularity, quiet (0) to busiest (4): pipeline/network.py levels.
 * Yellow to red; quiet trails thin, the reddest are the most popular and get a
 * very thin white outline. The yellow is a deep one (#e0b000, not lemon
 * #ffe600, which was 1.2:1 against the map), Peter's pick "D", 2026-10-19.
 */
export const POPULARITY_RAMP = ["#e0b000", "#ef9128", "#e2622a", "#cd421f", "#b31f1a"] as const;

/**
 * The two quietest levels also differ by shape, so they read without colour
 * (red-green colour blindness, sun on the screen): dotted, then dashed, then
 * solid. In line widths, for round-capped lines (the cap adds about one width).
 */
export const POPULARITY_DASH = [
  "match",
  ["get", "p"],
  0,
  ["literal", [0.01, 2.2]],
  1,
  ["literal", [1.4, 2.2]],
  ["literal", [1, 0]],
] as const;

/**
 * Thin dark thread drawn under the two quietest levels, so yellow stays readable
 * on white and pale roads (Peter, 2026-10-22).
 */
export const QUIET_THREAD = "#5c4500";

/** Outline around the busiest level only, about 0.8 px each side. */
export const POPULARITY_TOP_OUTLINE = "#ffffff";

/** A colour washed out towards grey: `amount` 0 keeps it, 1 is plain grey of the same lightness. */
export function desaturate(hex: string, amount = 0.75): string {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const grey = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return `#${rgb.map((c) => Math.round(c + (grey - c) * amount).toString(16).padStart(2, "0")).join("")}`;
}


export const POPULARITY_LABEL = ["málo chodená", "", "", "", "najobľúbenejšia"] as const;

/** One colour per kind of trip goal: cards, trip page, map pins and filters. */
export const GOAL_COLOUR: Record<DestinationKind, string> = {
  vrchol: "#5b4fd1",
  vodopad: "#0a8f92",
  pleso: "#2577d9",
  hrad: "#b9620c",
  vyhliadka: "#cf3f74",
  jaskyna: "#86573a",
  chata: "#3f8628",
  roklina: "#7a6a12",
  ine: "#5b6455",
};

/** Places on the way (huts, springs...), on the map and in the "Na trase" list. */
export const POI_COLOUR: Record<PoiKind, string> = {
  chata: "#3f8628",
  obcerstvenie: "#d9580d",
  pramen: "#1b8fcc",
  vyhliadka: "#cf3f74",
  utulna: "#86573a",
  hrad: "#b9620c",
  ihrisko: "#8a6d00",
};

/** The routes to one place, side by side on the comparison map: A (main), then B to H (loops after the routes). */
export const ROUTE_COLOURS = ["#1769d1", "#b35a00", "#6b4fbf", "#0f8a6c", "#c2337a", "#00838f", "#7a5c00", "#a23b2a"];
export const ROUTE_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
