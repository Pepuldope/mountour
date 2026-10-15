// Every map stays on Slovakia: it can't be dragged or zoomed out further than the
// country plus a small margin, and everything outside the border is darkened
// (Peter, 2026-10-14; prototype "Mapa len na Slovensku", option A).
import type { Map as MlMap } from "maplibre-gl";

/** Slovakia's extent, west/south/east/north (public/data/map/border.json). */
const SK_BOX = [16.84, 47.73, 22.57, 49.62] as const;
/** About 15 km past the border each way. */
const MARGIN_LON = 0.2;
const MARGIN_LAT = 0.13;

export const BORDER_URL = "/data/map/border.json";

const OUTSIDE_FILL = "#14233b";
const OUTSIDE_OPACITY = 0.24;
const BORDER_OPACITY = 0.55;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOf = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

/**
 * Slovakia plus the margin, widened to the map's own shape. As the map's
 * maxBounds it lets you zoom out exactly until the whole country shows (a tall
 * phone map then sees more above and below), and never drift past it.
 */
export function limitBox(width: number, height: number): [[number, number], [number, number]] {
  let [w, s, e, n] = [SK_BOX[0] - MARGIN_LON, SK_BOX[1] - MARGIN_LAT, SK_BOX[2] + MARGIN_LON, SK_BOX[3] + MARGIN_LAT];
  if (width > 0 && height > 0) {
    const bw = ((e - w) * Math.PI) / 180;
    const y0 = mercY(s);
    const y1 = mercY(n);
    const want = width / height;
    if (bw / (y1 - y0) < want) {
      const extra = (((y1 - y0) * want - bw) * 180) / Math.PI / 2;
      w -= extra;
      e += extra;
    } else {
      const mid = (y0 + y1) / 2;
      const half = bw / want / 2;
      s = latOf(mid - half);
      n = latOf(mid + half);
    }
  }
  return [[w, s], [e, n]];
}

let border: Promise<GeoJSON.Feature<GeoJSON.Polygon> | null> | null = null;
function loadBorder() {
  border ??= fetch(BORDER_URL)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((f) => {
      if (!f) border = null; // try again next time (offline now)
      return f;
    });
  return border;
}

/**
 * Keep the map on Slovakia and darken everything outside it. Call on "load",
 * before adding our own layers, so the shade covers the base map (its labels
 * too) but stays under the trails, which may cross the border a little.
 */
export function keepInSlovakia(map: MlMap): () => void {
  const limit = () => {
    const c = map.getContainer();
    map.setMaxBounds(limitBox(c.clientWidth, c.clientHeight));
  };
  limit();
  map.on("resize", limit);

  // The border file comes later; the shade then goes under the first layer we
  // added, which is just above the whole base map.
  const baseLayers = map.getStyle()?.layers?.length ?? 0;
  let done = false;
  loadBorder().then((f) => {
    if (!f || done || !map.getStyle()) return;
    const ring = f.geometry.coordinates[0];
    const before = map.getStyle().layers[baseLayers]?.id;
    map.addSource("outside", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        // The whole world with Slovakia cut out.
        geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], [...ring].reverse()] },
      },
    });
    map.addSource("border", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } } });
    map.addLayer({ id: "outside", type: "fill", source: "outside", paint: { "fill-color": OUTSIDE_FILL, "fill-opacity": OUTSIDE_OPACITY, "fill-antialias": false } }, before);
    map.addLayer({ id: "border", type: "line", source: "border", layout: { "line-join": "round" }, paint: { "line-color": OUTSIDE_FILL, "line-width": 1.4, "line-opacity": BORDER_OPACITY } }, before);
  });
  return () => {
    done = true;
    map.off("resize", limit);
  };
}
