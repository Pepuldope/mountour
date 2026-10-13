"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BBox, LatLng, TrailDetail } from "@/lib/types";
import { haversineM, nearestOnPath } from "@/lib/geo";
import { useDriveRoute, useWalkRoute } from "@/lib/useDriveRoute";
import { useUserLocation } from "@/lib/userLocation";
import { useHomeStop } from "@/lib/useHomeStop";
import { fetchTrack } from "@/lib/gpx";
import { POI_LABEL, TRANSIT_LABEL } from "@/lib/format";
import { kindSvg } from "@/lib/kindIcons";
import { POI_COLOUR } from "@/lib/palette";
import { trackColor } from "@/lib/mapLayers";
import { TrailMap } from "@/components/TrailMapClient";
import type { MapMarker, MapTrack } from "@/components/TrailMap";
import { useTripAccess } from "@/components/TripAccess";
import { NETWORK_ON } from "@/lib/trailNetwork";

/** Another route to the same place: drawn faint, a tap opens it. */
export interface OtherRoute {
  slug: string;
  label: string;
  points: [number, number][];
}

interface Props {
  detail: TrailDetail;
  gpxUrl: string | null;
  others?: OtherRoute[];
}

/** Other routes in ink, faint: clearly not the walk you picked, still easy to see. */
const OTHER_ROUTE_COLOUR = "#14233b";

/** Closer than this, the car is at the trail: no walking link. */
const AT_TRAIL_M = 60;

const pair = (p: LatLng): [number, number] => [p.lat, p.lon];

/**
 * The trip sheet's map: one track plus every pin that belongs to the trip.
 * With a start, the whole way: the drive (dashed) to the chosen parking, the
 * walk from there to the trail (dotted), then the trail itself.
 */
export function TripMap({ detail, gpxUrl, others = [] }: Props) {
  const { trail, trailheads, pois } = detail;
  const router = useRouter();
  const { parkingLots, choice, choose, destination, trailJoin, walkFrom, transit, stops, stopChoice, chooseStop, skip } = useTripAccess();
  const [points, setPoints] = useState<[number, number][]>([]);
  const { start } = useUserLocation();
  const homeStop = useHomeStop(transit ? start : null);
  const drive = useDriveRoute(start, destination);

  // Where the walk to the trail begins: the stop, the chosen parking, else the end of the road route.
  // It ends where it meets the trail: the start, or the nearest point when parked up the trail.
  const driveEnd = drive.route?.points[drive.route.points.length - 1];
  const carStop: LatLng | null = walkFrom ?? (!transit && driveEnd ? { lat: driveEnd[0], lon: driveEnd[1] } : null);
  const needsWalk = carStop !== null && trailJoin !== null && haversineM(carStop, trailJoin) > AT_TRAIL_M;
  const walk = useWalkRoute(needsWalk ? carStop : null, needsWalk ? trailJoin : null);
  const walkLeg = useMemo<[number, number][] | undefined>(() => {
    if (!needsWalk) return undefined;
    // No footpath route (offline, router down): a straight dotted line still shows where to go.
    const pts = walk.route?.points ?? [pair(carStop!), pair(trailJoin!)];
    return [pair(carStop!), ...pts, pair(trailJoin!)];
  }, [needsWalk, walk.route, carStop?.lat, carStop?.lon, trailJoin]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Parked up the trail: the stretch below the join is drawn faint, the walk you do in full colour.
  // There-and-back tracks run out and back, so that stretch is cut at both ends.
  const otherTracks = useMemo<MapTrack[]>(
    () => others.map((o) => ({ slug: o.slug, label: o.label, points: o.points, color: OTHER_ROUTE_COLOUR, state: "dimmed" })),
    [others]
  );
  const tracks = useMemo<MapTrack[]>(() => {
    const color = trackColor(trail.marking);
    // Other routes first, so the one you picked draws on top where they share a trail.
    const whole: MapTrack[] = [...otherTracks, { slug: trail.slug, points, color, state: "selected" }];
    if (!skip || !trailJoin || points.length < 3) return whole;
    const ll = points.map(([lat, lon]) => ({ lat, lon }));
    const mid = Math.floor((points.length - 1) / 2);
    const out = nearestOnPath(ll.slice(0, mid + 1), trailJoin);
    const back = nearestOnPath(ll.slice(mid), trailJoin);
    if (!out || !back) return whole;
    const a: [number, number] = [out.point.lat, out.point.lon];
    const b: [number, number] = [back.point.lat, back.point.lon];
    const bi = mid + back.i;
    return [
      ...otherTracks,
      { slug: `${trail.slug}-skipped-out`, points: [...points.slice(0, out.i + 1), a], color, state: "dimmed" },
      { slug: `${trail.slug}-skipped-back`, points: [b, ...points.slice(bi + 1)], color, state: "dimmed" },
      { slug: trail.slug, points: [a, ...points.slice(out.i + 1, bi + 1), b], color, state: "selected" },
    ];
  }, [trail.slug, trail.marking, points, skip, trailJoin, otherTracks]);

  const markers = useMemo<MapMarker[]>(
    () => [
      ...trailheads.map((t) => ({
        id: `th-${t.id}`,
        kind: "trailhead" as const,
        location: t.location,
        title: t.name,
        lines: ["Začiatok trasy"],
      })),
      // By car only parking, by train or bus only the stops: never both.
      ...(transit
        ? []
        : parkingLots.map((p, i) => ({
            id: `pk-${p.id}`,
            kind: "parking" as const,
            location: p.location,
            title: p.name,
            lines: [...(p.note ? [p.note] : []), ...(i === choice ? ["Vybraté parkovisko"] : [])],
            active: i === choice,
            dimmed: i !== choice,
            // Tapping another parking picks it (the plan and both routes follow).
            onClick: i === choice ? undefined : () => choose(i),
          }))),
      ...(transit
        ? stops.map((s, i) => ({
            id: `ts-${s.id}`,
            kind: `transit-${s.mode}` as const,
            location: s.location,
            title: s.name,
            lines: [
              TRANSIT_LABEL[s.mode],
              s.join ? `${s.join.walk_m} m od trasy` : `${s.distance_m} m od začiatku trasy`,
              ...(i === stopChoice ? ["Tu vystúpite"] : []),
            ],
            active: i === stopChoice,
            dimmed: i !== stopChoice,
            onClick: i === stopChoice ? undefined : () => chooseStop(i),
          }))
        : []),
      ...(transit && homeStop
        ? [
            {
              id: "home-stop",
              kind: `transit-${homeStop.mode}` as const,
              location: homeStop.location,
              title: homeStop.name,
              lines: [`Tu nastúpite, ${homeStop.distance_m} m od štartu`],
            },
          ]
        : []),
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
    [trailheads, parkingLots, choice, choose, stops, stopChoice, chooseStop, homeStop, pois, transit]
  );

  // The trail plus where the car stops; with a drive, the whole day (start -> parking -> trail).
  // Fitted once per start and way of travel: picking another parking keeps the view where it is.
  const baseKey = `${start?.lat},${start?.lon},${transit},${trail.slug}`;
  const [driveFitFor, setDriveFitFor] = useState<string | null>(null);
  if (drive.route && driveFitFor !== baseKey) setDriveFitFor(baseKey);
  const fitKey = `${baseKey},${driveFitFor === baseKey}`;
  const bounds = useMemo<BBox | null>(() => {
    const pts: [number, number][] = [...(drive.route?.points ?? [])];
    if (carStop) pts.push(pair(carStop));
    if (trail.bbox) pts.push(pair(trail.bbox.sw), pair(trail.bbox.ne));
    // The other routes to the place too, so you see where else you could start.
    for (const o of others) pts.push(...o.points);
    if (pts.length === 0) return null;
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    return {
      sw: { lat: Math.min(...lats), lon: Math.min(...lons) },
      ne: { lat: Math.max(...lats), lon: Math.max(...lons) },
    };
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TrailMap
      tracks={tracks}
      markers={markers}
      bounds={bounds}
      driveLeg={driveLeg}
      walkLeg={walkLeg}
      network={NETWORK_ON ? "context" : undefined}
      onSelectTrail={(slug) => {
        if (others.some((o) => o.slug === slug)) router.push(`/trasa/${slug}`, { scroll: false });
      }}
      ariaLabel="Mapa trasy"
    />
  );
}
