"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Marker, StyleSpecification } from "maplibre-gl";
import type { BBox, LatLng } from "@/lib/types";
import { MAP_STYLE_URL } from "@/lib/mapLayers";
import { useUserLocation } from "@/lib/userLocation";

type MapLibre = typeof import("maplibre-gl");

export type TrackState = "normal" | "selected" | "dimmed";

export interface MapTrack {
  slug: string;
  /** The trail's name, kept on the map feature. */
  label?: string;
  points: [number, number][];
  /** Line colour: the trail's KST marking (lib/mapLayers trackColor). */
  color: string;
  state: TrackState;
}

export type MarkerKind = "trailhead" | "parking" | "transit-autobus" | "transit-elektricka" | "transit-vlak" | "poi";

export interface MapMarker {
  id: string;
  kind: MarkerKind;
  location: LatLng;
  title: string;
  /** Extra popup lines (plain text). */
  lines?: string[];
  dimmed?: boolean;
  active?: boolean;
  /** Clicking the marker selects this trail (home page). */
  trailSlug?: string;
}

interface Props {
  tracks: MapTrack[];
  markers: MapMarker[];
  /** The map re-fits to this box whenever it changes. */
  bounds: BBox | null;
  onSelectTrail?: (slug: string) => void;
  /** Drive from the trip's start to the parking, drawn dashed under the trail. */
  driveLeg?: [number, number][];
  ariaLabel: string;
  className?: string;
}

const MARKER_GLYPH: Record<MarkerKind, string> = {
  trailhead: "",
  parking: "P",
  "transit-autobus": "A",
  "transit-elektricka": "E",
  "transit-vlak": "V",
  poi: "*",
};

const MARKER_CLASS: Record<MarkerKind, string> = {
  trailhead: "mt-pin-trailhead",
  parking: "mt-pin-parking",
  "transit-autobus": "mt-pin-transit",
  "transit-elektricka": "mt-pin-transit",
  "transit-vlak": "mt-pin-transit",
  poi: "mt-pin-poi",
};

const SLOVAKIA: [[number, number], [number, number]] = [
  [16.8, 47.7],
  [22.6, 49.6],
];
const FIT_PADDING = 32;

/** [lat, lon] (our data) -> [lon, lat] (GeoJSON / MapLibre). */
const lngLat = (p: [number, number]): [number, number] => [p[1], p[0]];

function popupContent(title: string, lines: string[] = []): HTMLElement {
  const el = document.createElement("div");
  const h = document.createElement("strong");
  h.textContent = title;
  el.appendChild(h);
  for (const line of lines) {
    const p = document.createElement("div");
    p.textContent = line;
    el.appendChild(p);
  }
  return el;
}

function pinElement(className: string, glyph: string, title: string): HTMLElement {
  const el = document.createElement("div");
  el.className = `mt-pin ${className}`;
  el.textContent = glyph;
  el.title = title;
  return el;
}

function fit(map: MlMap, b: BBox) {
  map.fitBounds(
    [
      [b.sw.lon, b.sw.lat],
      [b.ne.lon, b.ne.lat],
    ],
    { padding: FIT_PADDING, maxZoom: 15, duration: 0 }
  );
}

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#e4ebe3" } }],
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * MapLibre map on OpenFreeMap vector tiles. Trails are our own lines in their
 * KST colour with a white casing (like the painted marks); drive leg dashed.
 */
export function TrailMap({ tracks, markers, bounds, onSelectTrail, driveLeg, ariaLabel, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<{ ml: MapLibre; map: MlMap } | null>(null);
  const onSelectRef = useRef(onSelectTrail);
  const boundsRef = useRef<BBox | null>(bounds);
  const markerRefs = useRef<Marker[]>([]);
  const userMarkerRefs = useRef<Marker[]>([]);
  const { fix, start } = useUserLocation();

  useEffect(() => {
    onSelectRef.current = onSelectTrail;
  }, [onSelectTrail]);

  // Create the map once; tear it down on unmount.
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let observer: ResizeObserver | null = null;

    async function init() {
      const ml = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      map = new ml.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        bounds: SLOVAKIA,
        attributionControl: { compact: true },
        cooperativeGestures: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");

      // Base map unreachable (offline, blocked): fall back to a plain background
      // so the trail, pins and drive leg still show.
      let styleFailed = false;
      map.on("error", (e) => {
        if (styleFailed || !map || map.isStyleLoaded() || !String(e.error?.message).includes(MAP_STYLE_URL)) return;
        styleFailed = true;
        map.setStyle(FALLBACK_STYLE);
      });

      map.on("load", () => {
        if (!map || cancelled) return;
        map.addSource("drive", { type: "geojson", data: EMPTY });
        map.addSource("tracks", { type: "geojson", data: EMPTY });
        map.addLayer({
          id: "drive-casing",
          type: "line",
          source: "drive",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.8 },
        });
        map.addLayer({
          id: "drive-line",
          type: "line",
          source: "drive",
          layout: { "line-join": "round" },
          paint: { "line-color": "#17213a", "line-width": 3.5, "line-dasharray": [2, 2] },
        });
        // White band under the colour, like the painted KST mark.
        map.addLayer({
          id: "track-casing",
          type: "line",
          source: "tracks",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": ["match", ["get", "state"], "selected", 10, "dimmed", 5, 7],
            "line-opacity": ["match", ["get", "state"], "dimmed", 0.4, 1],
          },
        });
        map.addLayer({
          id: "track-line",
          type: "line",
          source: "tracks",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["match", ["get", "state"], "selected", 5, "dimmed", 2.5, 3.5],
            "line-opacity": ["match", ["get", "state"], "dimmed", 0.35, 1],
          },
        });
        // Wide invisible line so thin tracks are easy to tap.
        map.addLayer({
          id: "track-hit",
          type: "line",
          source: "tracks",
          paint: { "line-color": "#000000", "line-width": 18, "line-opacity": 0 },
        });
        map.on("click", "track-hit", (e) => {
          const slug = e.features?.[0]?.properties?.slug as string | undefined;
          if (slug) onSelectRef.current?.(slug);
        });
        setCtx({ ml, map });
      });

      // The map sits in flex/sticky containers whose size can change: keep the
      // requested area in view rather than whatever zoom fit the old size.
      observer = new ResizeObserver(() => {
        if (!map) return;
        map.resize();
        if (boundsRef.current) fit(map, boundsRef.current);
      });
      observer.observe(containerRef.current);
    }

    init();

    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      map = null;
      setCtx(null);
    };
  }, []);

  // Fit when the requested area changes.
  const boundsKey = bounds ? `${bounds.sw.lat},${bounds.sw.lon},${bounds.ne.lat},${bounds.ne.lon}` : "";
  useEffect(() => {
    boundsRef.current = bounds;
    if (ctx && bounds) fit(ctx.map, bounds);
    // `bounds` is tracked via boundsKey so a new-but-equal object doesn't refit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, boundsKey]);

  // Tracks: dimmed first, selected last so it paints on top.
  useEffect(() => {
    if (!ctx) return;
    const order: Record<TrackState, number> = { dimmed: 0, normal: 1, selected: 2 };
    const features: GeoJSON.Feature[] = [...tracks]
      .filter((t) => t.points.length >= 2)
      .sort((a, b) => order[a.state] - order[b.state])
      .map((t) => ({
        type: "Feature",
        properties: { slug: t.slug, color: t.color, state: t.state, label: t.label ?? "" },
        geometry: { type: "LineString", coordinates: t.points.map(lngLat) },
      }));
    (ctx.map.getSource("tracks") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
  }, [ctx, tracks]);

  // Drive leg.
  useEffect(() => {
    if (!ctx) return;
    const data: GeoJSON.FeatureCollection =
      driveLeg && driveLeg.length >= 2
        ? {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: driveLeg.map(lngLat) } },
            ],
          }
        : EMPTY;
    (ctx.map.getSource("drive") as GeoJSONSource | undefined)?.setData(data);
  }, [ctx, driveLeg]);

  // Markers: HTML elements so they can use the brand's square trail marks.
  useEffect(() => {
    if (!ctx) return;
    const { ml, map } = ctx;
    for (const m of markerRefs.current) m.remove();
    // Active last so it sits on top.
    markerRefs.current = [...markers]
      .sort((a, b) => Number(!!a.active) - Number(!!b.active))
      .map((m) => {
        const el = pinElement(
          `${MARKER_CLASS[m.kind]}${m.dimmed ? " mt-pin-dimmed" : ""}${m.active ? " is-active" : ""}`,
          MARKER_GLYPH[m.kind],
          m.title
        );
        const marker = new ml.Marker({ element: el })
          .setLngLat([m.location.lon, m.location.lat])
          .setPopup(new ml.Popup({ offset: 14, closeButton: false }).setDOMContent(popupContent(m.title, m.lines)))
          .addTo(map);
        const slug = m.trailSlug;
        if (slug) el.addEventListener("click", () => onSelectRef.current?.(slug));
        return marker;
      });
  }, [ctx, markers]);

  // Start pin (typed place) and "you are here" dot (GPS).
  useEffect(() => {
    if (!ctx) return;
    const { ml, map } = ctx;
    for (const m of userMarkerRefs.current) m.remove();
    userMarkerRefs.current = [];
    if (start?.source === "manual") {
      userMarkerRefs.current.push(
        new ml.Marker({ element: pinElement("mt-pin-start", "S", start.label) })
          .setLngLat([start.lon, start.lat])
          .setPopup(new ml.Popup({ offset: 14, closeButton: false }).setDOMContent(popupContent("Štart", [start.label])))
          .addTo(map)
      );
    }
    if (fix) {
      userMarkerRefs.current.push(
        new ml.Marker({ element: pinElement("mt-pin-me", "", "Vaša poloha") }).setLngLat([fix.lon, fix.lat]).addTo(map)
      );
    }
  }, [ctx, fix, start]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} role="region" aria-label={ariaLabel} />;
}
