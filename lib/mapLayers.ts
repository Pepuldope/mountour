// Single source of truth for map tile layers (map component, offline tile
// caching in lib/tiles.ts and the service worker all agree on these URLs).

export interface TileLayerDef {
  /** Leaflet URL template; `{s}` is only present when `subdomains` is set. */
  url: string;
  subdomains?: string;
  maxZoom: number;
  opacity: number;
  attribution: string;
}

/** Topographic base map. */
export const BASE_LAYER: TileLayerDef = {
  url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  subdomains: "abc",
  maxZoom: 17,
  opacity: 1,
  attribution: "Mapa: © OpenStreetMap, SRTM | Štýl: © OpenTopoMap (CC-BY-SA)",
};

/** Marked hiking trails (turistické značky) drawn over the base map. */
export const TRAILS_OVERLAY: TileLayerDef = {
  url: "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png",
  maxZoom: 17,
  opacity: 0.7,
  attribution: "Značené trasy: © waymarkedtrails.org",
};

/** Fills in a layer's URL for one tile; always uses subdomain `a` (for caching). */
export function tileUrl(layer: TileLayerDef, z: number, x: number, y: number): string {
  return layer.url
    .replace("{s}", layer.subdomains ? layer.subdomains[0] : "")
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}
