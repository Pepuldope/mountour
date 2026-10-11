"use client";

import { useEffect, useMemo, useState } from "react";
import type { BBox, LatLng, TrailDetail } from "@/lib/types";
import { haversineM } from "@/lib/geo";
import { useDriveRoute, useWalkRoute } from "@/lib/useDriveRoute";
import { useUserLocation } from "@/lib/userLocation";
import { fetchTrack } from "@/lib/gpx";
import { POI_LABEL, TRANSIT_LABEL } from "@/lib/format";
import { kindSvg } from "@/lib/kindIcons";
import { POI_COLOUR } from "@/lib/palette";
import { trackColor } from "@/lib/mapLayers";
import { TrailMap } from "@/components/TrailMapClient";
import type { MapMarker, MapTrack } from "@/components/TrailMap";
import { useTripAccess } from "@/components/TripAccess";
import { NETWORK_ON } from "@/lib/trailNetwork";

interface Props {
  detail: TrailDetail;
  gpxUrl: string | null;
}

/** Closer than this, the car is at the trail: no walking link. */
const AT_TRAIL_M = 60;

const pair = (p: LatLng): [number, number] => [p.lat, p.lon];

/**
 * The trip sheet's map: one track plus every pin that belongs to the trip.
 * With a start, the whole way: the drive (dashed) to the chosen parking, the
 * walk from there to the trail (dotted), then the trail itself.
 */
export function TripMap({ detail, gpxUrl }: Props) {
  const { trail, trailheads, transitStops, pois } = detail;
  const { parkingLots, choice, choose, destination, trailStart, walkFrom, transit, stop } = useTripAccess();
  const [points, setPoints] = useState<[number, number][]>([]);
  const { start } = useUserLocation();
  const drive = useDriveRoute(start, destination);

  // Where the walk to the trail begins: the stop, the chosen parking, else the end of the road route.
  const driveEnd = drive.route?.points[drive.route.points.length - 1];
  const carStop: LatLng | null = walkFrom ?? (!transit && driveEnd ? { lat: driveEnd[0], lon: driveEnd[1] } : null);
  const needsWalk = carStop !== null && trailStart !== null && haversineM(carStop, trailStart) > AT_TRAIL_M;
  const walk = useWalkRoute(needsWalk ? carStop : null, needsWalk ? trailStart : null);
  const walkLeg = useMemo<[number, number][] | undefined>(() => {
    if (!needsWalk) return undefined;
    // No footpath route (offline, router down): a straight dotted line still shows where to go.
    const pts = walk.route?.points ?? [pair(carStop!), pair(trailStart!)];
    return [pair(carStop!), ...pts, pair(trailStart!)];
  }, [needsWalk, walk.route, carStop?.lat, carStop?.lon, trailStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // The road route ends on the nearest road; finish the line at the parking itself.
  const driveLeg = useMemo<[number, number][] | undefined>(() => {
    const pts = drive.route?.points;
    if (!pts?.length || !destination) return pts;
    return [...pts, pair(destination)];
  }, [drive.route, destination]);

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
    () => [{ slug: trail.slug, points, color: trackColor(trail.marking), state: "selected" }],
    [trail.slug, trail.marking, points]
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
      ...parkingLots.map((p, i) => ({
        id: `pk-${p.id}`,
        kind: "parking" as const,
        location: p.location,
        title: p.name,
        lines: [...(p.note ? [p.note] : []), ...(i === choice ? ["Vybraté parkovisko"] : [])],
        active: !transit && i === choice,
        dimmed: transit || i !== choice,
        // Tapping another parking picks it (the plan and both routes follow).
        onClick: i === choice ? undefined : () => choose(i),
      })),
      ...transitStops.map((s) => ({
        id: `ts-${s.id}`,
        kind: `transit-${s.mode}` as const,
        location: s.location,
        title: s.name,
        lines: [TRANSIT_LABEL[s.mode], `${s.distance_m} m od začiatku trasy`],
        active: transit && s.id === stop?.id,
      })),
      ...pois.map((p) => ({
        id: `poi-${p.id}`,
        kind: "poi" as const,
        location: p.location,
        title: p.name,
        lines: [POI_LABEL[p.kind]],
        colour: POI_COLOUR[p.kind],
        icon: kindSvg(p.kind, 14),
      })),
    ],
    [trailheads, parkingLots, choice, choose, transitStops, pois, transit, stop]
  );

  // The trail plus where the car stops; with a drive, the whole day (start -> parking -> trail).
  const bounds = useMemo<BBox | null>(() => {
    const pts: [number, number][] = [...(drive.route?.points ?? [])];
    if (carStop) pts.push(pair(carStop));
    if (trail.bbox) pts.push(pair(trail.bbox.sw), pair(trail.bbox.ne));
    if (pts.length === 0) return null;
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    return {
      sw: { lat: Math.min(...lats), lon: Math.min(...lons) },
      ne: { lat: Math.max(...lats), lon: Math.max(...lons) },
    };
  }, [drive.route, carStop?.lat, carStop?.lon, trail.bbox]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TrailMap
      tracks={tracks}
      markers={markers}
      bounds={bounds}
      driveLeg={driveLeg}
      walkLeg={walkLeg}
      network={NETWORK_ON ? "context" : undefined}
      ariaLabel="Mapa trasy"
    />
  );
}
