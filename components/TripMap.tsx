"use client";

import { useEffect, useMemo, useState } from "react";
import type { BBox, LatLng, TrailDetail } from "@/lib/types";
import { useDriveRoute } from "@/lib/useDriveRoute";
import { useUserLocation } from "@/lib/userLocation";
import { fetchTrack } from "@/lib/gpx";
import { POI_LABEL, TRANSIT_LABEL } from "@/lib/format";
import { TrailMap } from "@/components/TrailMapClient";
import type { MapMarker, MapTrack } from "@/components/TrailMap";

interface Props {
  detail: TrailDetail;
  gpxUrl: string | null;
  /** Where the drive leg ends (parking, else trailhead). */
  destination: LatLng | null;
}

/** The trip sheet's map: one track plus every pin that belongs to the trip. */
export function TripMap({ detail, gpxUrl, destination }: Props) {
  const { trail, trailheads, parkingLots, transitStops, pois } = detail;
  const [points, setPoints] = useState<[number, number][]>([]);
  const { start } = useUserLocation();
  const drive = useDriveRoute(start, destination);

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

  // With a drive, show the whole day (start -> parking -> trail); the user can zoom in.
  const bounds = useMemo<BBox | null>(() => {
    const pts = drive.route?.points;
    if (!pts || pts.length === 0) return trail.bbox;
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    if (trail.bbox) {
      lats.push(trail.bbox.sw.lat, trail.bbox.ne.lat);
      lons.push(trail.bbox.sw.lon, trail.bbox.ne.lon);
    }
    return {
      sw: { lat: Math.min(...lats), lon: Math.min(...lons) },
      ne: { lat: Math.max(...lats), lon: Math.max(...lons) },
    };
  }, [drive.route, trail.bbox]);

  return (
    <TrailMap
      tracks={tracks}
      markers={markers}
      bounds={bounds}
      driveLeg={drive.route?.points}
      ariaLabel="Mapa trasy"
    />
  );
}
