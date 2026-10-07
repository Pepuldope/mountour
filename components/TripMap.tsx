"use client";

import { useEffect, useMemo, useState } from "react";
import type { TrailDetail } from "@/lib/types";
import { fetchTrack } from "@/lib/gpx";
import { POI_LABEL, TRANSIT_LABEL } from "@/lib/format";
import { TrailMap } from "@/components/TrailMapClient";
import type { MapMarker, MapTrack } from "@/components/TrailMap";

interface Props {
  detail: TrailDetail;
  gpxUrl: string | null;
}

/** The trip sheet's map: one track plus every pin that belongs to the trip. */
export function TripMap({ detail, gpxUrl }: Props) {
  const { trail, trailheads, parkingLots, transitStops, pois } = detail;
  const [points, setPoints] = useState<[number, number][]>([]);

  useEffect(() => {
    let cancelled = false;
    if (gpxUrl) {
      fetchTrack(gpxUrl).then((track) => {
        if (!cancelled) setPoints(track.map((p) => [p.lat, p.lon]));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [gpxUrl]);

  const tracks = useMemo<MapTrack[]>(
    () => [{ slug: trail.slug, points, difficulty: trail.difficulty, state: "selected" }],
    [trail.slug, trail.difficulty, points]
  );

  const markers = useMemo<MapMarker[]>(
    () => [
      ...trailheads.map((t) => ({
        id: `th-${t.id}`,
        kind: "trailhead" as const,
        location: t.location,
        title: t.name,
        lines: ["Začiatok trasy"],
      })),
      ...parkingLots.map((p) => ({
        id: `pk-${p.id}`,
        kind: "parking" as const,
        location: p.location,
        title: p.name,
        lines: p.note ? [p.note] : [],
      })),
      ...transitStops.map((s) => ({
        id: `ts-${s.id}`,
        kind: `transit-${s.mode}` as const,
        location: s.location,
        title: s.name,
        lines: [TRANSIT_LABEL[s.mode], `${s.distance_m} m od začiatku trasy`],
      })),
      ...pois.map((p) => ({
        id: `poi-${p.id}`,
        kind: "poi" as const,
        location: p.location,
        title: p.name,
        lines: [POI_LABEL[p.kind]],
      })),
    ],
    [trailheads, parkingLots, transitStops, pois]
  );

  return (
    <TrailMap
      tracks={tracks}
      markers={markers}
      bounds={trail.bbox}
      ariaLabel="Mapa trasy"
    />
  );
}
