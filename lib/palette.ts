// Colours that carry meaning on the map and in lists, kept in one place so the
// visual identity work can swap them without touching the features.
// Current values follow the "Feel Lab" prototype (2026-10-11); not final.
import type { DestinationKind, PoiKind } from "@/lib/tripSchema";

/** Trail popularity, quiet (0) to busiest (4): pipeline/network.py levels. */
export const POPULARITY_RAMP = ["#fde4a0", "#f9bb47", "#ef8a2c", "#d9541f", "#a5301c"] as const;

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
