// Every marked hiking trail in Slovakia as a map layer (data: pipeline/network.py,
// public/data/trails). The country view draws a light overview file; zoomed in,
// the detailed file of each grid cell on screen is fetched once and added.
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";

export type NetworkMode = "full" | "context";

/** Off until the all-trails map is approved from its preview; then every map shows the network. */
export const NETWORK_ON = false;

export interface TrailNetworkMeta {
  version: number;
  generated_at: string;
  grid: { lon0: number; lat0: number; dx: number; dy: number };
  cells: string[];
  levels: number;
  km: number;
}

const BASE = "/data/trails";
/** From this zoom on, the detailed cells replace the overview. */
export const DETAIL_ZOOM = 11;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Grid cells ("ix_iy") that overlap a [west, south, east, north] box. */
export function cellsInView(
  grid: TrailNetworkMeta["grid"],
  available: Set<string>,
  [w, s, e, n]: [number, number, number, number]
): string[] {
  const out: string[] = [];
  const x0 = Math.floor((w - grid.lon0) / grid.dx);
  const x1 = Math.floor((e - grid.lon0) / grid.dx);
  const y0 = Math.floor((s - grid.lat0) / grid.dy);
  const y1 = Math.floor((n - grid.lat0) / grid.dy);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const key = `${x}_${y}`;
      if (available.has(key)) out.push(key);
    }
  }
  return out;
}

/**
 * Adds the network under whatever layers come after it. "full": coloured by
 * popularity (ramp, quiet to busy), busier also wider. "context": one faint
 * colour, so the trip in focus stands out. Returns a cleanup function.
 */
export function attachTrailNetwork(map: MlMap, mode: NetworkMode, ramp: readonly string[]): () => void {
  let stopped = false;
  map.addSource("network", { type: "geojson", data: EMPTY });
  map.addSource("network-detail", { type: "geojson", data: EMPTY });

  const colour =
    mode === "full"
      ? (["match", ["get", "p"], ...ramp.flatMap((c, i) => [i, c]), ramp[0]] as unknown as string)
      : "#8a8f7a";
  const width = [
    "interpolate",
    ["linear"],
    ["zoom"],
    7,
    ["+", 0.6, ["*", 0.35, ["get", "p"]]],
    12,
    ["+", 1.4, ["*", 0.6, ["get", "p"]]],
    15,
    ["+", 2.5, ["*", 0.8, ["get", "p"]]],
  ] as unknown as number;
  const opacity = mode === "full" ? 0.9 : 0.45;
  for (const [id, source, minzoom, maxzoom] of [
    ["network-line", "network", 0, DETAIL_ZOOM],
    ["network-detail-line", "network-detail", DETAIL_ZOOM, 24],
  ] as const) {
    map.addLayer({
      id,
      type: "line",
      source,
      minzoom,
      maxzoom,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": colour, "line-width": width, "line-opacity": opacity },
    });
  }

  let meta: TrailNetworkMeta | null = null;
  const loaded = new Map<string, GeoJSON.Feature[]>();
  const pending = new Set<string>();

  function showDetail() {
    const features = [...loaded.values()].flat();
    (map.getSource("network-detail") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
  }

  async function loadVisibleCells() {
    if (stopped || !meta || map.getZoom() < DETAIL_ZOOM - 0.5) return;
    const b = map.getBounds();
    const want = cellsInView(meta.grid, new Set(meta.cells), [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    const todo = want.filter((k) => !loaded.has(k) && !pending.has(k));
    if (todo.length === 0) return;
    todo.forEach((k) => pending.add(k));
    const got = await Promise.all(
      todo.map((k) => getJson<GeoJSON.FeatureCollection>(`${BASE}/c/${k}.json?v=${meta!.generated_at}`))
    );
    todo.forEach((k, i) => {
      pending.delete(k);
      if (got[i]) loaded.set(k, got[i]!.features);
    });
    if (!stopped) showDetail();
  }

  const onMove = () => void loadVisibleCells();
  map.on("moveend", onMove);

  (async () => {
    meta = await getJson<TrailNetworkMeta>(`${BASE}/meta.json`);
    if (!meta || stopped) return;
    const overview = await getJson<GeoJSON.FeatureCollection>(`${BASE}/overview.json?v=${meta.generated_at}`);
    if (overview && !stopped) (map.getSource("network") as GeoJSONSource | undefined)?.setData(overview);
    loadVisibleCells();
  })();

  return () => {
    stopped = true;
    map.off("moveend", onMove);
  };
}
