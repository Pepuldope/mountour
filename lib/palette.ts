// Colours that carry meaning on the map and in lists, kept in one place so the
// visual identity work can swap them without touching the features.
// Values decided with Peter in the "Feel Lab" prototype (2026-10-11, strategy/12-feel/).
import type { DestinationKind, PoiKind } from "@/lib/tripSchema";

/**
 * Trail popularity, quiet (0) to busiest (4): pipeline/network.py levels.
 * Bright yellow to red; quiet trails thin (and dotted in the prototype), the
 * reddest are the most popular and get a very thin white outline.
 */
export const POPULARITY_RAMP = ["#ffe600", "#f3a12f", "#e8682a", "#d9481f", "#c8261b"] as const;

/** Outline around the busiest level only, about 0.8 px each side. */
export const POPULARITY_TOP_OUTLINE = "#ffffff";

/**
 * The quietest (yellow) level gets a white outline and a faint yellow glow, so it
 * stands out on forest and meadow alike (Peter picked look C, 2026-10-15).
 */
export const POPULARITY_QUIET_OUTLINE = "#ffffff";
export const POPULARITY_QUIET_GLOW = "#fff27a";

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

/** The routes to one place, side by side on the comparison map: A (main), B, C. */
export const ROUTE_COLOURS = ["#1769d1", "#b35a00", "#6b4fbf"];
export const ROUTE_LETTERS = ["A", "B", "C", "D"];
