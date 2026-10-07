import type { BBox } from "@/lib/types";

function lon2tileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function lat2tileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z
  );
}

/** OSM tile URLs covering `bbox` for zoom levels 13-15 (inclusive). */
export function tileUrlsForBbox(bbox: BBox, zooms: number[] = [13, 14, 15]): string[] {
  const urls: string[] = [];
  for (const z of zooms) {
    const xMin = lon2tileX(bbox.sw.lon, z);
    const xMax = lon2tileX(bbox.ne.lon, z);
    // Y is inverted: north (ne.lat) gives the smaller tile Y.
    const yMin = lat2tileY(bbox.ne.lat, z);
    const yMax = lat2tileY(bbox.sw.lat, z);

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }
  return urls;
}
