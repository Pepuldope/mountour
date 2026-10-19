"use client";

import type { LatLng } from "@/lib/types";

// "Show it on the map": a list row (a hut, a spring... on the trip page) asks the trip map to
// glide to that place and open its pin. The map listens; the list needs no handle on it.
const EVENT = "mountour-map-focus";

export interface MapFocus {
  /** The pin's id on the map (MapMarker.id), to open its label. */
  id: string;
  location: LatLng;
}

export function focusOnMap(target: MapFocus) {
  window.dispatchEvent(new CustomEvent<MapFocus>(EVENT, { detail: target }));
}

export function onMapFocus(cb: (target: MapFocus) => void): () => void {
  const listener = (e: Event) => cb((e as CustomEvent<MapFocus>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
