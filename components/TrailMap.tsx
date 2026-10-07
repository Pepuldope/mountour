"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { BBox, Difficulty, LatLng } from "@/lib/types";
import { BASE_LAYER, TRAILS_OVERLAY } from "@/lib/mapLayers";
import { useUserLocation } from "@/lib/userLocation";

type Leaflet = typeof import("leaflet");

export type TrackState = "normal" | "selected" | "dimmed";

export interface MapTrack {
  slug: string;
  /** Shown as a tooltip when set. */
  label?: string;
  points: [number, number][];
  difficulty: Difficulty;
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
  /** Clicking the marker selects this trail (home page). */
  trailSlug?: string;
}

interface Props {
  tracks: MapTrack[];
  markers: MapMarker[];
  /** The map re-fits to this box whenever it changes. */
  bounds: BBox | null;
  onSelectTrail?: (slug: string) => void;
  ariaLabel: string;
  className?: string;
}

// Muted so they read on top of topo contours; light / medium / hard.
export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  lahka: "#2f8f4e",
  stredna: "#d98a00",
  tazka: "#c0392b",
};

const MARKER_GLYPH: Record<MarkerKind, string> = {
  trailhead: "",
  parking: "P",
  "transit-autobus": "A",
  "transit-elektricka": "E",
  "transit-vlak": "V",
  poi: "*",
};

const MARKER_SIZE: Record<MarkerKind, number> = {
  trailhead: 16,
  parking: 26,
  "transit-autobus": 22,
  "transit-elektricka": 22,
  "transit-vlak": 22,
  poi: 22,
};

const SLOVAKIA_CENTER: [number, number] = [48.6667, 19.6833];

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

export function TrailMap({ tracks, markers, bounds, onSelectTrail, ariaLabel, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<{ L: Leaflet; map: LeafletMap } | null>(null);
  const trackLayerRef = useRef<LayerGroup | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const userLayerRef = useRef<LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectTrail);
  const { fix } = useUserLocation();

  useEffect(() => {
    onSelectRef.current = onSelectTrail;
  }, [onSelectTrail]);

  // Create the map once; tear it down on unmount.
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    let observer: ResizeObserver | null = null;

    async function init() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current).setView(SLOVAKIA_CENTER, 8);
      L.tileLayer(BASE_LAYER.url, {
        subdomains: BASE_LAYER.subdomains,
        maxZoom: BASE_LAYER.maxZoom,
        attribution: BASE_LAYER.attribution,
      }).addTo(map);
      L.tileLayer(TRAILS_OVERLAY.url, {
        maxZoom: TRAILS_OVERLAY.maxZoom,
        opacity: TRAILS_OVERLAY.opacity,
        attribution: TRAILS_OVERLAY.attribution,
      }).addTo(map);

      trackLayerRef.current = L.layerGroup().addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);

      // The map sits in flex/sticky containers whose size can change.
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(containerRef.current);

      setCtx({ L, map });
    }

    init();

    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      map = null;
      trackLayerRef.current = null;
      markerLayerRef.current = null;
      userLayerRef.current = null;
      setCtx(null);
    };
  }, []);

  // Fit when the requested area changes.
  const boundsKey = bounds ? `${bounds.sw.lat},${bounds.sw.lon},${bounds.ne.lat},${bounds.ne.lon}` : "";
  useEffect(() => {
    if (!ctx || !bounds) return;
    ctx.map.fitBounds(
      [
        [bounds.sw.lat, bounds.sw.lon],
        [bounds.ne.lat, bounds.ne.lon],
      ],
      { padding: [24, 24] }
    );
    // `bounds` is tracked via boundsKey so a new-but-equal object doesn't refit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, boundsKey]);

  // Tracks: dimmed first, selected last so it paints on top.
  useEffect(() => {
    const group = trackLayerRef.current;
    if (!ctx || !group) return;
    const { L } = ctx;
    group.clearLayers();

    const order: Record<TrackState, number> = { dimmed: 0, normal: 1, selected: 2 };
    for (const t of [...tracks].sort((a, b) => order[a.state] - order[b.state])) {
      if (t.points.length < 2) continue;
      const style =
        t.state === "selected"
          ? { weight: 7, opacity: 1 }
          : t.state === "dimmed"
            ? { weight: 3, opacity: 0.3 }
            : { weight: 4, opacity: 0.85 };
      const line = L.polyline(t.points, { color: DIFFICULTY_COLOR[t.difficulty], ...style });
      if (t.label) line.bindTooltip(t.label, { sticky: true });
      line.addTo(group);

      if (onSelectRef.current) {
        // Wide invisible line so thin tracks are easy to tap.
        L.polyline(t.points, { weight: 16, opacity: 0 })
          .on("click", () => onSelectRef.current?.(t.slug))
          .addTo(group);
      }
    }
  }, [ctx, tracks]);

  // Markers.
  useEffect(() => {
    const group = markerLayerRef.current;
    if (!ctx || !group) return;
    const { L } = ctx;
    group.clearLayers();

    for (const m of markers) {
      const size = MARKER_SIZE[m.kind];
      const icon = L.divIcon({
        className: `mt-marker mt-marker-${m.kind}${m.dimmed ? " mt-marker-dimmed" : ""}`,
        html: MARKER_GLYPH[m.kind],
        iconSize: [size, size],
      });
      const marker = L.marker([m.location.lat, m.location.lon], { icon, title: m.title })
        .bindPopup(popupContent(m.title, m.lines))
        .addTo(group);
      const slug = m.trailSlug;
      if (slug && onSelectRef.current) marker.on("click", () => onSelectRef.current?.(slug));
    }
  }, [ctx, markers]);

  // "You are here": blue dot + accuracy circle.
  useEffect(() => {
    const group = userLayerRef.current;
    if (!ctx || !group) return;
    const { L } = ctx;
    group.clearLayers();
    if (!fix) return;

    L.circle([fix.lat, fix.lon], {
      radius: fix.accuracy,
      color: "#2563eb",
      weight: 1,
      fillColor: "#2563eb",
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(group);
    L.circleMarker([fix.lat, fix.lon], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#2563eb",
      fillOpacity: 1,
    })
      .bindTooltip("Tvoja poloha")
      .addTo(group);
  }, [ctx, fix]);

  return (
    <div
      ref={containerRef}
      className={className ?? "h-full w-full"}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
