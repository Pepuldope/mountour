// The maps' line files (public/data/trails, public/data/map) are stored packed
// (pipeline/packed.py): each property as one list, each line as whole-number
// steps from the previous point. About half the download of plain GeoJSON for
// the same lines. This turns them back into GeoJSON; plain GeoJSON passes through.

export interface PackedLines {
  format: "lines-v1";
  scale: number;
  props: Record<string, unknown[]>;
  lines: number[][];
}

export function unpackLines(data: PackedLines | GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  if ((data as GeoJSON.FeatureCollection).type === "FeatureCollection") return data as GeoJSON.FeatureCollection;
  const { scale, props, lines } = data as PackedLines;
  const keys = Object.keys(props);
  const features: GeoJSON.Feature[] = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const flat = lines[i];
    const coordinates: number[][] = new Array(flat.length / 2);
    let x = 0;
    let y = 0;
    for (let j = 0; j < flat.length; j += 2) {
      x += flat[j];
      y += flat[j + 1];
      coordinates[j / 2] = [x / scale, y / scale];
    }
    const properties: Record<string, unknown> = {};
    for (const k of keys) properties[k] = props[k][i];
    features[i] = { type: "Feature", properties, geometry: { type: "LineString", coordinates } };
  }
  return { type: "FeatureCollection", features };
}

/** A packed (or plain) line file as GeoJSON, or null when it can't be loaded. */
export async function fetchLines(url: string): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const res = await fetch(url);
    return res.ok ? unpackLines(await res.json()) : null;
  } catch {
    return null;
  }
}
