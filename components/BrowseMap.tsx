"use client";

import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification, GeoJSONSource, LineLayerSpecification, Map as MlMap, MapMouseEvent, Marker } from "maplibre-gl";
import type { LatLng } from "@/lib/types";
import type { DestinationKind } from "@/lib/tripSchema";
import { MAP_STYLE_URL, mapPixelRatio } from "@/lib/mapLayers";
import { keepInSlovakia } from "@/lib/slovakia";
import { GOAL_COLOUR, POPULARITY_RAMP, POPULARITY_TOP_OUTLINE } from "@/lib/palette";
import { lineFeeder } from "@/lib/mapFeed";
import { fetchLines } from "@/lib/packedLines";
import { attachTrailNetwork, cellsInView, LINE_TILE_MAX } from "@/lib/trailNetwork";
import { useUserLocation } from "@/lib/userLocation";
import { FALLBACK_STYLE, SLOVAKIA, hideBasePois } from "@/components/TrailMap";

type MapLibre = typeof import("maplibre-gl");
type Box = [number, number, number, number];

/** A trip as the home map needs it. */
export interface BrowseTrip {
  slug: string;
  goal: DestinationKind;
  rank: number;
  /** The goal (peak, waterfall...): where its square sits. */
  location: LatLng;
  start: LatLng;
}

/** A mountain area: one dot while zoomed out. */
export interface BrowseArea {
  /** Matches the `id` of its outline in /data/map/areas.json. */
  id?: string;
  name: string;
  short: string;
  location: LatLng;
  bbox: Box;
}

/** A request to move the map; a new `key` moves it again. */
export type MapFocus =
  | { key: number; kind: "box"; bbox: Box; maxZoom?: number }
  | { key: number; kind: "point"; location: LatLng; zoom: number };

export interface MapView {
  /** [west, south, east, north] */
  bounds: Box;
  center: [number, number];
  zoom: number;
  /** Below this zoom the map shows areas instead of trips (lower on narrow screens). */
  areaZoom: number;
}

interface Props {
  /** The trips that pass the filters: their lines and squares. */
  trips: BrowseTrip[];
  areas: BrowseArea[];
  /** The areas' outlines (they split all of Slovakia), drawn while zoomed out. */
  outlines: GeoJSON.FeatureCollection | null;
  selected: string | null;
  /** A card hovered in the list: its line is outlined. */
  highlighted: string | null;
  focus: MapFocus | null;
  initialView: MapView | null;
  onView: (view: MapView) => void;
  /** Click or tap on a trip (its line or square); `also` = other trips under the pointer. */
  onPick: (pick: { slug: string; also: string[]; x: number; y: number } | null) => void;
  /** Pointer over a trip (mouse only). */
  onHover: (hover: { slug: string; x: number; y: number } | null) => void;
  /** Tap on a grey trail no trip uses: the trips closest to that spot. */
  onTrailTap: (tap: { nearby: { slug: string; km: number }[]; x: number; y: number }) => void;
  /** Phones keep the bottom of the map free for the preview. */
  bottomInset: number;
  ariaLabel: string;
}

const MAP_DATA = "/data/map";
/** Below this zoom the map shows areas; their squares come from here on. */
export const AREA_ZOOM = 9;
/**
 * How much earlier than on a wide screen areas give way to trips: a phone shows
 * a whole mountain area only around zoom 7.5, so its trips must show from there.
 */
export function areaShift(width: number): number {
  return Math.min(2, Math.max(0, Math.log2(1200 / Math.max(width, 1))));
}
/** Squares by popularity: the best known show from SQUARE_MIN, every trip by SQUARE_MAX. */
const SQUARE_MIN = AREA_ZOOM;
const SQUARE_MAX = 12;
/** Pixels between squares at the zoom where they first show. */
const SPACING = 54;
const SUN = "#ffb81c";
const AREA_LINE = "#1769d1";
const NIGHT = "#14233b";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface Meta {
  generated_at: string;
  grid: { lon0: number; lat0: number; dx: number; dy: number };
  cells: string[];
}

/** The site's square trail mark (16 px, white edge, soft shadow), drawn for the map at 2x. */
function squareImage(fill: string, edge: string, size: number): ImageData {
  const r = 2;
  const pad = 3 * r;
  const s = size * r;
  const c = document.createElement("canvas");
  c.width = c.height = s + 2 * pad;
  const g = c.getContext("2d")!;
  g.shadowColor = "rgba(0,0,0,0.4)";
  g.shadowBlur = 3 * r;
  g.shadowOffsetY = 1 * r;
  g.fillStyle = edge;
  g.beginPath();
  g.roundRect(pad, pad, s, s, 3 * r);
  g.fill();
  g.shadowColor = "transparent";
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(pad + 2 * r, pad + 2 * r, s - 4 * r, s - 4 * r, 1.5 * r);
  g.fill();
  return g.getImageData(0, 0, c.width, c.height);
}

/**
 * The zoom at which each trip's square first shows: walk the levels up, place
 * trips best known first, and skip any closer than SPACING px to one already
 * placed. Popular trips take the space early; nothing regroups while zooming.
 */
function squareLevels(trips: BrowseTrip[], shift: number): Map<string, number> {
  const out = new Map<string, number>();
  const placed: BrowseTrip[] = [];
  const sorted = [...trips].sort((a, b) => b.rank - a.rank);
  for (let z = SQUARE_MIN; z <= SQUARE_MAX; z++) {
    // Spacing is measured where the level shows: zoom z, moved earlier by shift on narrow screens.
    const world = 512 * 2 ** (z - shift);
    const px = (t: BrowseTrip): [number, number] => [
      ((t.location.lon + 180) / 360) * world,
      (0.5 - Math.log(Math.tan(Math.PI / 4 + (t.location.lat * Math.PI) / 360)) / (2 * Math.PI)) * world,
    ];
    const grid = new Map<string, [number, number][]>();
    const add = (t: BrowseTrip) => {
      const p = px(t);
      const k = `${Math.floor(p[0] / SPACING)},${Math.floor(p[1] / SPACING)}`;
      const list = grid.get(k);
      if (list) list.push(p);
      else grid.set(k, [p]);
    };
    placed.forEach(add);
    for (const t of sorted) {
      if (out.has(t.slug)) continue;
      const [x, y] = px(t);
      const cx = Math.floor(x / SPACING);
      const cy = Math.floor(y / SPACING);
      let free = true;
      if (z < SQUARE_MAX) {
        for (let i = -1; i <= 1 && free; i++)
          for (let j = -1; j <= 1 && free; j++)
            for (const p of grid.get(`${cx + i},${cy + j}`) ?? [])
              if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < SPACING * SPACING) free = false;
      }
      if (free) {
        out.set(t.slug, z);
        placed.push(t);
        add(t);
      }
    }
  }
  return out;
}

const viewOf = (map: MlMap, shift: number): MapView => {
  const b = map.getBounds();
  const c = map.getCenter();
  return { bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], center: [c.lng, c.lat], zoom: map.getZoom(), areaZoom: AREA_ZOOM - shift };
};

const line = (coords: number[][] | undefined): GeoJSON.FeatureCollection =>
  coords && coords.length > 1
    ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] }
    : EMPTY;

/**
 * The home map: every trip as its own coloured line (by how well known it is)
 * over the whole marked-trail network in grey, so what you see is exactly what
 * a click selects. Zoomed out, one dot per mountain area; zoomed in, the trips'
 * square marks, the best known first. Lines load per area, for the view only.
 */
/**
 * Hides area names that would overlap a bigger area's dot or name. Areas come
 * biggest first and sit higher, so a big area is never hidden behind a small one.
 */
function declutter(els: HTMLElement[]) {
  const taken: DOMRect[] = [];
  const hits = (r: DOMRect) => taken.some((t) => r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top);
  els.forEach((el, i) => {
    el.style.zIndex = String(els.length - i);
    const label = el.lastElementChild as HTMLElement;
    label.style.visibility = "";
    taken.push((el.firstElementChild as HTMLElement).getBoundingClientRect());
    const r = label.getBoundingClientRect();
    if (hits(r)) label.style.visibility = "hidden";
    else taken.push(r);
  });
}

export function BrowseMap({
  trips,
  areas,
  outlines,
  selected,
  highlighted,
  focus,
  initialView,
  onView,
  onPick,
  onHover,
  onTrailTap,
  bottomInset,
  ariaLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<{ ml: MapLibre; map: MlMap; shift: number } | null>(null);
  // Every line seen so far, by slug: the detailed one once its area has loaded.
  const lines = useRef(new Map<string, { coords: number[][]; detailed: boolean }>());
  const [linesVersion, setLinesVersion] = useState(0);
  const handlers = useRef({ onView, onPick, onHover, onTrailTap });
  const tripsRef = useRef(trips);
  const areasRef = useRef(areas);
  const areaEls = useRef<HTMLElement[]>([]);
  const userMarkers = useRef<Marker[]>([]);
  const { fix, start } = useUserLocation();
  const initialRef = useRef(initialView);
  const insetRef = useRef(bottomInset);
  const zoomToAreaRef = useRef<(a: BrowseArea) => void>(() => {});
  const hoverAreaRef = useRef<(id: string | null) => void>(() => {});

  useEffect(() => {
    handlers.current = { onView, onPick, onHover, onTrailTap };
    tripsRef.current = trips;
    areasRef.current = areas;
    insetRef.current = bottomInset;
  });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let observer: ResizeObserver | null = null;
    let detachNetwork: (() => void) | null = null;
    let detachLimit: (() => void) | null = null;
    let shift = 0;
    let areaZoom = AREA_ZOOM;

    async function init() {
      const ml = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      shift = areaShift(containerRef.current.clientWidth);
      areaZoom = AREA_ZOOM - shift;
      const start = initialRef.current;
      map = new ml.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        ...(start ? { center: start.center, zoom: start.zoom } : { bounds: SLOVAKIA }),
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        fadeDuration: 0,
        minZoom: 5,
        pixelRatio: mapPixelRatio(),
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");

      let styleFailed = false;
      map.on("error", (e) => {
        if (styleFailed || !map || map.isStyleLoaded() || !String(e.error?.message).includes(MAP_STYLE_URL)) return;
        styleFailed = true;
        map.setStyle(FALLBACK_STYLE);
      });

      map.on("load", () => {
        if (!map || cancelled) return;
        const m = map;
        hideBasePois(m);
        detachLimit = keepInSlovakia(m);
        // Every marked trail, faint grey: the trips are drawn over it in colour.
        detachNetwork = attachTrailNetwork(m, "context", POPULARITY_RAMP, POPULARITY_TOP_OUTLINE);

        // Area outlines: like districts on a map, they fade as the trips take over.
        m.addSource("areas", { type: "geojson", data: EMPTY, promoteId: "id" });
        m.addLayer({
          id: "area-fill",
          type: "fill",
          source: "areas",
          maxzoom: areaZoom + 0.5,
          paint: {
            "fill-color": AREA_LINE,
            "fill-opacity": ["interpolate", ["linear"], ["zoom"], areaZoom - 0.6, ["case", ["boolean", ["feature-state", "hover"], false], 0.2, 0.06], areaZoom + 0.2, 0],
          },
        });
        m.addLayer({
          id: "area-line",
          type: "line",
          source: "areas",
          maxzoom: areaZoom + 0.5,
          layout: { "line-join": "round" },
          paint: {
            "line-color": AREA_LINE,
            "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.3, 9, 2],
            "line-opacity": ["interpolate", ["linear"], ["zoom"], areaZoom - 0.6, 0.7, areaZoom + 0.4, 0],
          },
        });

        const ramp = ["match", ["get", "p"], ...POPULARITY_RAMP.flatMap((c, i) => [i, c]), POPULARITY_RAMP[0]] as unknown as ExpressionSpecification;
        const width = (a: number, b: number, c: number, extra = 0) =>
          [
            "interpolate", ["linear"], ["zoom"],
            // The quietest level gets a little extra so it stays visible, still thinner than orange.
            7, ["+", a + extra, ["*", 0.35, ["get", "p"]], ["case", ["==", ["get", "p"], 0], 0.25, 0]],
            12, ["+", b + extra, ["*", 0.6, ["get", "p"]], ["case", ["==", ["get", "p"], 0], 0.35, 0]],
            15, ["+", c + extra, ["*", 0.8, ["get", "p"]], ["case", ["==", ["get", "p"], 0], 0.4, 0]],
          ] as unknown as ExpressionSpecification;
        const layout: LineLayerSpecification["layout"] = { "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "r"] };
        for (const [src, range, tileMax] of [
          ["trip-lines", { maxzoom: areaZoom }, Math.ceil(areaZoom)],
          ["trip-lines-d", { minzoom: areaZoom }, LINE_TILE_MAX],
        ] as [string, { maxzoom?: number; minzoom?: number }, number][]) {
          m.addSource(src, { type: "geojson", data: EMPTY, maxzoom: tileMax });
          // The best known trips get a thin white edge, like on the trail network before.
          m.addLayer({ id: `${src}-top`, type: "line", source: src, ...range, filter: ["==", ["get", "p"], 4], layout, paint: { "line-color": POPULARITY_TOP_OUTLINE, "line-width": width(0.6, 1.4, 2.5, 1), "line-opacity": 0.9 } });
          m.addLayer({ id: `${src}-line`, type: "line", source: src, ...range, layout, paint: { "line-color": ramp, "line-width": width(0.6, 1.4, 2.5), "line-opacity": ["case", ["==", ["get", "p"], 0], 1, 0.95] } });
          // Wide and invisible, so a thin line is easy to hit.
          m.addLayer({ id: `${src}-hit`, type: "line", source: src, ...range, paint: { "line-color": "#000", "line-width": 18, "line-opacity": 0 } });
        }

        m.addSource("hover", { type: "geojson", data: EMPTY, maxzoom: LINE_TILE_MAX });
        m.addLayer({ id: "hover-line", type: "line", source: "hover", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": NIGHT, "line-width": 5, "line-opacity": 0.55 } });
        m.addSource("sel", { type: "geojson", data: EMPTY, maxzoom: LINE_TILE_MAX });
        m.addLayer({ id: "sel-casing", type: "line", source: "sel", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9 } });
        m.addLayer({ id: "sel-line", type: "line", source: "sel", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": NIGHT, "line-width": 4.5 } });
        m.addSource("sel-start", { type: "geojson", data: EMPTY, maxzoom: LINE_TILE_MAX });
        m.addLayer({ id: "sel-start", type: "circle", source: "sel-start", paint: { "circle-color": "#ffffff", "circle-radius": 6, "circle-stroke-color": NIGHT, "circle-stroke-width": 3 } });

        // Squares: one layer per level, each fading in as its zoom is reached.
        for (const [kind, colour] of Object.entries(GOAL_COLOUR)) m.addImage(`sq-${kind}`, squareImage(colour, "#ffffff", 16), { pixelRatio: 2 });
        m.addImage("sq-active", squareImage(SUN, NIGHT, 22), { pixelRatio: 2 });
        m.addSource("squares", { type: "geojson", data: EMPTY });
        for (let z = SQUARE_MIN; z <= SQUARE_MAX; z++) {
          const fade = ["interpolate", ["linear"], ["zoom"], z - shift - 0.01, 0, z - shift + 0.15, 1] as unknown as ExpressionSpecification;
          m.addLayer({
            id: `sq-${z}`,
            type: "symbol",
            source: "squares",
            minzoom: z - shift - 0.01,
            filter: ["==", ["get", "z"], z],
            layout: { "icon-image": ["concat", "sq-", ["get", "g"]], "icon-allow-overlap": true, "icon-ignore-placement": true, "symbol-sort-key": ["-", 0, ["get", "r"]] },
            paint: { "icon-opacity": fade },
          });
        }
        m.addLayer({
          id: "sq-active",
          type: "symbol",
          source: "squares",
          filter: ["==", ["get", "s"], ""],
          layout: { "icon-image": "sq-active", "icon-allow-overlap": true, "icon-ignore-placement": true },
        });

        bindEvents(m);
        loadLines(m);
        m.on("moveend", () => {
          loadLines(m);
          handlers.current.onView(viewOf(m, shift));
        });
        m.on("zoom", () => showAreas(m.getZoom()));
        showAreas(m.getZoom());
        handlers.current.onView(viewOf(m, shift));
        setCtx({ ml, map: m, shift });
      });

      observer = new ResizeObserver(() => map?.resize());
      observer.observe(containerRef.current);
    }

    // ---- lines: the overview for the whole country, detailed areas as you look at them
    let meta: Meta | null = null;
    const loaded = new Set<string>();
    const pending = new Set<string>();
    const onMap = new Set<unknown>();
    const addLines = lineFeeder(() => map?.getSource("trip-lines-d") as GeoJSONSource | undefined);
    const getJson = async <T,>(url: string): Promise<T | null> => {
      try {
        const r = await fetch(url);
        return r.ok ? ((await r.json()) as T) : null;
      } catch {
        return null;
      }
    };
    const remember = (features: GeoJSON.Feature[], detailed: boolean) => {
      for (const f of features) {
        const slug = f.properties?.s as string;
        const known = lines.current.get(slug);
        if (known?.detailed && !detailed) continue;
        lines.current.set(slug, { coords: (f.geometry as GeoJSON.LineString).coordinates, detailed });
      }
      setLinesVersion((v) => v + 1);
    };
    async function loadLines(m: MlMap) {
      if (!meta) {
        meta = await getJson<Meta>(`${MAP_DATA}/meta.json`);
        if (!meta || cancelled) return;
        const overview = await fetchLines(`${MAP_DATA}/overview.json?v=${meta.generated_at}`);
        if (overview && !cancelled) {
          lineFeeder(() => m.getSource("trip-lines") as GeoJSONSource | undefined)(overview.features);
          remember(overview.features, false);
        }
      }
      if (m.getZoom() < areaZoom - 0.5) return;
      const b = m.getBounds();
      const w = b.getEast() - b.getWest();
      const h = b.getNorth() - b.getSouth();
      const want = cellsInView(meta.grid, new Set(meta.cells), [b.getWest() - w * 0.3, b.getSouth() - h * 0.3, b.getEast() + w * 0.3, b.getNorth() + h * 0.3]);
      const todo = want.filter((k) => !loaded.has(k) && !pending.has(k));
      await Promise.all(
        todo.map(async (k) => {
          pending.add(k);
          const got = await fetchLines(`${MAP_DATA}/c/${k}.json?v=${meta!.generated_at}`);
          pending.delete(k);
          if (!got || cancelled) return;
          loaded.add(k);
          // A trip crossing two areas is in both files: keep it once.
          const add = got.features.filter((f) => !onMap.has(f.properties?.s));
          add.forEach((f) => onMap.add(f.properties?.s));
          addLines(add);
          remember(got.features, true);
        })
      );
    }

    // ---- pointer
    const hitLayers = ["trip-lines-hit", "trip-lines-d-hit"];
    const squareLayers = Array.from({ length: SQUARE_MAX - SQUARE_MIN + 1 }, (_, i) => `sq-${SQUARE_MIN + i}`);
    function under(m: MlMap, e: MapMouseEvent, r: number): string[] {
      const box: [[number, number], [number, number]] = [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]];
      const rank = (f: { properties: Record<string, unknown> }) => -(f.properties.r as number);
      const sq = m.queryRenderedFeatures(box, { layers: squareLayers }).sort((a, b) => rank(a) - rank(b));
      const ln = m.queryRenderedFeatures(e.point, { layers: hitLayers }).sort((a, b) => rank(a) - rank(b));
      return [...new Set([...sq, ...ln].map((f) => f.properties.s as string))];
    }
    const onGrey = (m: MlMap, e: MapMouseEvent, r: number) =>
      m.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], {
        layers: ["network-line", "network-detail-line"].filter((id) => m.getLayer(id)),
      }).length > 0;
    function nearby(lat: number, lon: number) {
      const k = Math.cos((lat * Math.PI) / 180);
      const shown = new Set(tripsRef.current.map((t) => t.slug));
      const out: { slug: string; km: number }[] = [];
      for (const [slug, { coords }] of lines.current) {
        if (!shown.has(slug)) continue;
        let d = Infinity;
        for (const [x, y] of coords) d = Math.min(d, ((x - lon) * k) ** 2 + (y - lat) ** 2);
        const km = Math.sqrt(d) * 111.2;
        if (km < 6) out.push({ slug, km });
      }
      return out.sort((a, b) => a.km - b.km).slice(0, 3);
    }
    let hoverArea: string | null = null;
    const setHoverArea = (m: MlMap, id: string | null) => {
      if (id === hoverArea) return;
      if (hoverArea) m.setFeatureState({ source: "areas", id: hoverArea }, { hover: false });
      hoverArea = id;
      if (id) m.setFeatureState({ source: "areas", id }, { hover: true });
    };
    const areaAt = (m: MlMap, e: MapMouseEvent): string | null =>
      (m.queryRenderedFeatures(e.point, { layers: ["area-fill"] })[0]?.properties?.id as string | undefined) ?? null;
    function bindEvents(m: MlMap) {
      const fine = window.matchMedia("(pointer: fine)").matches;
      let hovering: string | null = null;
      m.on("mousemove", (e) => {
        if (!fine) return;
        if (m.getZoom() < areaZoom) {
          const area = areaAt(m, e);
          setHoverArea(m, area);
          const any = area !== null || m.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: ["trip-lines-line"] }).length > 0;
          m.getCanvas().style.cursor = any ? "zoom-in" : "";
          if (hovering) handlers.current.onHover((hovering = null));
          return;
        }
        const found = under(m, e, 6);
        m.getCanvas().style.cursor = found.length || onGrey(m, e, 5) ? "pointer" : "";
        const slug = found[0] ?? null;
        if (slug !== hovering || slug) {
          hovering = slug;
          handlers.current.onHover(slug ? { slug, x: e.point.x, y: e.point.y } : null);
        }
      });
      m.on("mouseout", () => {
        setHoverArea(m, null);
        hovering = null;
        handlers.current.onHover(null);
      });
      m.on("click", (e) => {
        const r = fine ? 6 : 14;
        // Zoomed out: a tap on any line zooms in there, so nothing is a dead end.
        if (m.getZoom() < areaZoom) {
          // Inside an area: show all of it.
          const id = areaAt(m, e);
          const area = id ? areasRef.current.find((a) => a.id === id) : undefined;
          if (area) return zoomToArea(m, area);
          const any = m.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], {
            layers: ["trip-lines-line", "network-line"].filter((id) => m.getLayer(id)),
          }).length;
          if (any) m.easeTo({ center: e.lngLat, zoom: areaZoom + 1.5 });
          return;
        }
        const found = under(m, e, r);
        if (found.length) {
          handlers.current.onPick({ slug: found[0], also: found.slice(1, 4), x: e.point.x, y: e.point.y });
          return;
        }
        if (onGrey(m, e, r)) {
          handlers.current.onTrailTap({ nearby: nearby(e.lngLat.lat, e.lngLat.lng), x: e.point.x, y: e.point.y });
          return;
        }
        handlers.current.onPick(null);
      });
    }

    function zoomToArea(m: MlMap, a: BrowseArea) {
      const cam = m.cameraForBounds([[a.bbox[0], a.bbox[1]], [a.bbox[2], a.bbox[3]]], { padding: 24 });
      // The whole area in view; trips show from the area zoom on, so never stop short of it.
      m.easeTo({ center: cam?.center ?? [a.location.lon, a.location.lat], zoom: Math.max(cam?.zoom ?? 0, areaZoom + 0.05) });
    }
    zoomToAreaRef.current = (a) => map && zoomToArea(map, a);
    hoverAreaRef.current = (id) => map && setHoverArea(map, id);

    // ---- areas: HTML dots made once, shown or hidden by zoom (never rebuilt, so they don't blink)
    let declutterSoon: ReturnType<typeof setTimeout> | undefined;
    function showAreas(z: number) {
      for (const el of areaEls.current) el.style.display = z < areaZoom ? "" : "none";
      // Measuring the names makes the browser lay out the page, too slow for
      // every frame of a pinch: a few times a second is enough, and the last
      // check always comes after the zoom stops.
      if (z >= areaZoom || declutterSoon) return;
      declutterSoon = setTimeout(() => {
        declutterSoon = undefined;
        declutter(areaEls.current);
      }, 150);
    }

    // The map (MapLibre, the trail lines, the tiles) is the heaviest part of the
    // home. On phones it sits below the first screen, so start it only when it
    // comes near the screen (300 px): ready by the time it is scrolled to,
    // and nothing downloaded for visitors who never get there.
    let near: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined" || !containerRef.current) {
      init();
    } else {
      near = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          near?.disconnect();
          near = null;
          init();
        },
        { rootMargin: "300px 0px" }
      );
      near.observe(containerRef.current);
    }
    return () => {
      cancelled = true;
      clearTimeout(declutterSoon);
      near?.disconnect();
      observer?.disconnect();
      detachNetwork?.();
      detachLimit?.();
      map?.remove();
      map = null;
      setCtx(null);
    };
  }, []);

  // Area dots.
  useEffect(() => {
    if (!ctx) return;
    const { ml, map } = ctx;
    const markers = areas.map((a) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "mt-area";
      el.setAttribute("aria-label", `${a.name}: priblížiť`);
      el.innerHTML = `<span aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M2.5 19.5 9.5 7l3.4 5.6 2.1-3.1 6.5 10z" fill="currentColor"/></svg></span><span></span>`;
      (el.lastChild as HTMLElement).textContent = a.short;
      el.style.display = map.getZoom() < AREA_ZOOM - ctx.shift ? "" : "none";
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        zoomToAreaRef.current(a);
      });
      if (a.id) {
        el.addEventListener("mouseenter", () => hoverAreaRef.current(a.id!));
        el.addEventListener("mouseleave", () => hoverAreaRef.current(null));
      }
      return new ml.Marker({ element: el, anchor: "top", offset: [0, -15] }).setLngLat([a.location.lon, a.location.lat]).addTo(map);
    });
    areaEls.current = markers.map((m) => m.getElement());
    requestAnimationFrame(() => declutter(areaEls.current));
    return () => {
      markers.forEach((m) => m.remove());
      areaEls.current = [];
    };
  }, [ctx, areas]);

  // Area outlines.
  useEffect(() => {
    if (!ctx) return;
    (ctx.map.getSource("areas") as GeoJSONSource | undefined)?.setData(outlines ?? EMPTY);
  }, [ctx, outlines]);

  // Which trips show: their lines and squares.
  useEffect(() => {
    if (!ctx) return;
    const { map } = ctx;
    const slugs = trips.map((t) => t.slug);
    const only = ["in", ["get", "s"], ["literal", slugs]] as unknown as ExpressionSpecification;
    for (const src of ["trip-lines", "trip-lines-d"]) {
      map.setFilter(`${src}-line`, only);
      map.setFilter(`${src}-hit`, only);
      map.setFilter(`${src}-top`, ["all", ["==", ["get", "p"], 4], only] as unknown as ExpressionSpecification);
    }
    const level = squareLevels(trips, ctx.shift);
    (map.getSource("squares") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: trips.map((t) => ({
        type: "Feature",
        properties: { s: t.slug, g: t.goal, r: t.rank, z: level.get(t.slug) },
        geometry: { type: "Point", coordinates: [t.location.lon, t.location.lat] },
      })),
    });
  }, [ctx, trips]);

  // The chosen trip: dark line, start dot, yellow square.
  useEffect(() => {
    if (!ctx) return;
    const { map } = ctx;
    const t = selected ? trips.find((x) => x.slug === selected) : undefined;
    (map.getSource("sel") as GeoJSONSource | undefined)?.setData(line(selected ? lines.current.get(selected)?.coords : undefined));
    (map.getSource("sel-start") as GeoJSONSource | undefined)?.setData(
      t ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [t.start.lon, t.start.lat] } } : EMPTY
    );
    map.setFilter("sq-active", ["==", ["get", "s"], selected ?? ""]);
  }, [ctx, selected, trips, linesVersion]);

  // Outline for a trip pointed at (on the map or in the list).
  useEffect(() => {
    if (!ctx) return;
    const coords = highlighted && highlighted !== selected ? lines.current.get(highlighted)?.coords : undefined;
    (ctx.map.getSource("hover") as GeoJSONSource | undefined)?.setData(line(coords));
  }, [ctx, highlighted, selected, linesVersion]);

  // Move when asked.
  useEffect(() => {
    if (!ctx || !focus) return;
    const { map } = ctx;
    const pad = { top: 40, left: 40, right: 40, bottom: 40 + insetRef.current };
    if (focus.kind === "box") {
      const [w, s, e, n] = focus.bbox;
      map.fitBounds([[w, s], [e, n]], { padding: pad, maxZoom: focus.maxZoom ?? 13 });
    } else {
      map.easeTo({ center: [focus.location.lon, focus.location.lat], zoom: focus.zoom });
    }
    // Only a new request (key) moves the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, focus?.key]);

  // Start pin (typed place) and "you are here" dot (GPS).
  useEffect(() => {
    if (!ctx) return;
    const { ml, map } = ctx;
    for (const m of userMarkers.current) m.remove();
    userMarkers.current = [];
    const pin = (cls: string, text: string, title: string) => {
      const el = document.createElement("div");
      el.className = `mt-pin ${cls}`;
      el.textContent = text;
      el.title = title;
      return el;
    };
    if (start?.source === "manual") {
      userMarkers.current.push(new ml.Marker({ element: pin("mt-pin-start", "S", start.label) }).setLngLat([start.lon, start.lat]).addTo(map));
    }
    if (fix) userMarkers.current.push(new ml.Marker({ element: pin("mt-pin-me", "", "Vaša poloha") }).setLngLat([fix.lon, fix.lat]).addTo(map));
  }, [ctx, fix, start]);

  // `isolate`: area dots stack among themselves only, never above the legend and buttons laid over the map.
  return <div ref={containerRef} className="isolate h-full w-full" role="region" aria-label={ariaLabel} />;
}
