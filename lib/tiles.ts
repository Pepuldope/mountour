import type { BBox } from "@/lib/types";
import { MAP_STYLE_URL, VECTOR_MAX_ZOOM } from "@/lib/mapLayers";

function lon2tileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function lat2tileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

/** Fills a `{z}/{x}/{y}` template for every tile covering `bbox` at the given zooms. */
export function tileUrlsForBbox(template: string, bbox: BBox, zooms: number[]): string[] {
  const urls: string[] = [];
  for (const z of zooms) {
    const xMin = lon2tileX(bbox.sw.lon, z);
    const xMax = lon2tileX(bbox.ne.lon, z);
    // Y is inverted: north (ne.lat) gives the smaller tile Y.
    const yMin = lat2tileY(bbox.ne.lat, z);
    const yMax = lat2tileY(bbox.sw.lat, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        urls.push(template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
      }
    }
  }
  return urls;
}

interface StyleJson {
  sources: Record<string, { type: string; url?: string; tiles?: string[] }>;
  glyphs?: string;
  sprite?: string | { url: string }[];
  layers: { layout?: { "text-font"?: unknown } }[];
}

/**
 * Everything the vector map needs to draw `bbox` offline: the style, its
 * TileJSON, the tiles (z10-14, enough to overzoom while hiking), sprites and
 * the glyph ranges Slovak text uses. Best effort: returns [] when offline.
 */
export async function offlineMapUrls(bbox: BBox): Promise<string[]> {
  try {
    const style = (await (await fetch(MAP_STYLE_URL)).json()) as StyleJson;
    const urls = [MAP_STYLE_URL];
    const zooms = [10, 11, 12, 13, VECTOR_MAX_ZOOM];

    for (const src of Object.values(style.sources)) {
      if (src.type !== "vector") continue;
      let tiles = src.tiles;
      if (!tiles && src.url) {
        urls.push(src.url);
        tiles = ((await (await fetch(src.url)).json()) as { tiles?: string[] }).tiles;
      }
      if (tiles?.[0]) urls.push(...tileUrlsForBbox(tiles[0], bbox, zooms));
    }

    const sprites = typeof style.sprite === "string" ? [style.sprite] : (style.sprite ?? []).map((s) => s.url);
    for (const s of sprites) urls.push(`${s}.json`, `${s}.png`, `${s}@2x.json`, `${s}@2x.png`);

    if (style.glyphs) {
      const fonts = new Set<string>();
      for (const l of style.layers) {
        const f = l.layout?.["text-font"];
        if (Array.isArray(f)) fonts.add(f.join(","));
      }
      // 0-255 Latin, 256-511 Latin Extended (č, ď, ľ, ň, ŕ, š, ť, ž).
      for (const font of fonts) {
        for (const range of ["0-255", "256-511"]) {
          urls.push(style.glyphs.replace("{fontstack}", encodeURIComponent(font)).replace("{range}", range));
        }
      }
    }
    return urls;
  } catch {
    return [];
  }
}
