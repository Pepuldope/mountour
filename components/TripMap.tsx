"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { BBox, LatLng, ParkingLot, Poi } from "@/lib/types";
import { parseGpxTrack } from "@/lib/gpx";
import { POI_LABEL } from "@/lib/format";

interface Props {
  gpxUrl: string | null;
  bbox: BBox | null;
  parkingLots: ParkingLot[];
  pois: Poi[];
}

export function TripMap({ gpxUrl, bbox, parkingLots, pois }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const center: LatLng = bbox
        ? { lat: (bbox.sw.lat + bbox.ne.lat) / 2, lon: (bbox.sw.lon + bbox.ne.lon) / 2 }
        : { lat: 48.6667, lon: 19.6833 }; // fallback: geographic center of Slovakia

      const map = L.map(containerRef.current).setView([center.lat, center.lon], 13);
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      if (bbox) {
        map.fitBounds([
          [bbox.sw.lat, bbox.sw.lon],
          [bbox.ne.lat, bbox.ne.lon],
        ]);
      }

      const parkingIcon = L.divIcon({
        className: "mt-marker mt-marker-parking",
        html: "P",
        iconSize: [26, 26],
      });
      const poiIcon = L.divIcon({
        className: "mt-marker mt-marker-poi",
        html: "*",
        iconSize: [22, 22],
      });

      for (const lot of parkingLots) {
        L.marker([lot.location.lat, lot.location.lon], { icon: parkingIcon })
          .addTo(map)
          .bindPopup(lot.name);
      }

      for (const poi of pois) {
        L.marker([poi.location.lat, poi.location.lon], { icon: poiIcon })
          .addTo(map)
          .bindPopup(`${POI_LABEL[poi.kind]}: ${poi.name}`);
      }

      if (gpxUrl) {
        try {
          const res = await fetch(gpxUrl);
          const text = await res.text();
          const track = parseGpxTrack(text);
          if (track.length > 1 && !cancelled) {
            const latlngs = track.map((p) => [p.lat, p.lon]) as [number, number][];
            L.polyline(latlngs, { color: "#1f6f4a", weight: 4 }).addTo(map);
            if (!bbox) map.fitBounds(latlngs);
          }
        } catch {
          // Offline / GPX not cached yet: the map still shows tiles + pins.
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [gpxUrl, bbox, parkingLots, pois]);

  return (
    <div
      ref={containerRef}
      className="h-72 w-full overflow-hidden rounded-xl border border-[var(--border)]"
      role="img"
      aria-label="Mapa trasy"
    />
  );
}
