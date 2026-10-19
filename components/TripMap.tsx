"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BBox, LatLng, TrailDetail } from "@/lib/types";
import { haversineM, nearestOnPath } from "@/lib/geo";
import { useDriveRoute, useWalkRoute } from "@/lib/useDriveRoute";
import { useUserLocation } from "@/lib/userLocation";
import { useHomeStop } from "@/lib/useHomeStop";
import { fetchTrack } from "@/lib/gpx";
import { GOAL_LABEL, POI_LABEL, TRANSIT_LABEL, formatWalk } from "@/lib/format";
import { kindSvg } from "@/lib/kindIcons";
import { GOAL_COLOUR, POI_COLOUR } from "@/lib/palette";
import { trackColor } from "@/lib/mapLayers";
import { TrailMap } from "@/components/TrailMapClient";
import type { MapMarker, MapTrack } from "@/components/TrailMap";
import { useTripAccess } from "@/components/TripAccess";
import { setHoveredRoute, useHoveredRoute } from "@/lib/routeHover";
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
  /** Phones, map in the page: taps only (see TrailMap). */
  tapOnly?: boolean;
}

/** Other routes in a muted slate: clearly not the walk you picked (that one keeps its trail colour), still easy to see. */
const OTHER_ROUTE_COLOUR = "#6b7a93";
/** An other route under the pointer (on the map or in the route list) lights up. */
const OTHER_ROUTE_HOVER = "#1769d1";

/** Closer than this, the car is at the trail: no walking link. */
const AT_TRAIL_M = 60;
/** A stored walk ending this close to the join point is the one to draw (pipeline/walks.py). */
const STORED_END_M = 40;
/** A place on the way this close to the goal is the goal itself: one pin, not two. */
const SAME_PLACE_M = 60;

const pair = (p: LatLng): [number, number] => [p.lat, p.lon];

/**
 * The trip sheet's map: one track plus every pin that belongs to the trip.
 * With a start, the whole way: the drive (dashed) to the chosen parking, the
 * walk from there to the trail (dotted), then the trail itself.
 */
export function TripMap({ detail, gpxUrl, others = [], tapOnly = false }: Props) {
  const { trail, trailheads, pois } = detail;
  const router = useRouter();
  const { parkingLots, choice, choose, rideTo: destination, trailJoin, walkFrom, walkLine, transit, stops, stopChoice, chooseStop, skip } = useTripAccess();
  const [points, setPoints] = useState<[number, number][]>([]);
  const { start } = useUserLocation();
  const homeStop = useHomeStop(transit ? start : null);
  // By bus or train the line runs along the roads to the stop: roughly the bus's way, no timetable yet.
  const drive = useDriveRoute(start, destination);

  // Where the walk to the trail begins: the stop, the chosen parking, else the end of the road route.
  // It ends where it meets the trail: the start, or the nearest point when parked up the trail.
  const driveEnd = drive.route?.points[drive.route.points.length - 1];
  const carStop: LatLng | null = walkFrom ?? (!transit && driveEnd ? { lat: driveEnd[0], lon: driveEnd[1] } : null);
  const needsWalk = carStop !== null && trailJoin !== null && haversineM(carStop, trailJoin) > AT_TRAIL_M;
  // The weekly build stores this walk on paths; use it when it ends where the page joins the trail.
  const storedEnd = walkLine?.line[walkLine.line.length - 1];
  const stored =
    needsWalk && storedEnd && haversineM({ lat: storedEnd[1], lon: storedEnd[0] }, trailJoin!) <= STORED_END_M ? walkLine : null;
  const walk = useWalkRoute(needsWalk && !stored ? carStop : null, needsWalk && !stored ? trailJoin : null);
  const walkLeg = useMemo<[number, number][] | undefined>(() => {
    if (!needsWalk) return undefined;
    // No footpath route (offline, router down): a straight dotted line still shows where to go.
    const pts = stored?.line.map(([lon, lat]) => [lat, lon] as [number, number]) ?? walk.route?.points ?? [pair(carStop!), pair(trailJoin!)];
    return [pair(carStop!), ...pts, pair(trailJoin!)];
  }, [needsWalk, stored, walk.route, carStop?.lat, carStop?.lon, trailJoin]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const hovered = useHoveredRoute();
  const otherTracks = useMemo<MapTrack[]>(
    () =>
      others.map((o) =>
        o.slug === hovered
          ? { slug: o.slug, label: o.label, points: o.points, color: OTHER_ROUTE_HOVER, state: "selected", showThrough: true }
          : { slug: o.slug, label: o.label, points: o.points, color: OTHER_ROUTE_COLOUR, state: "normal", showThrough: true }
      ),
    [others, hovered]
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

  const goal = trail.goal_location;
  const goalKind = trail.goal ?? "ine";
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
              s.join ? `${formatWalk(s.join.walk_m)} od trasy` : `${formatWalk(s.distance_m)} od začiatku trasy`,
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
              lines: [`Tu nastúpite, ${formatWalk(homeStop.distance_m)} od štartu`],
            },
          ]
        : []),
      ...pois.filter((p) => !goal || haversineM(p.location, goal) > SAME_PLACE_M).map((p) => ({
        id: `poi-${p.id}`,
        kind: "poi" as const,
        location: p.location,
        title: p.name,
        lines: [POI_LABEL[p.kind]],
        colour: POI_COLOUR[p.kind],
        icon: kindSvg(p.kind, 14),
      })),
      // What you came to see (the tower, cave, castle...): its kind's colour and icon, as on the home map.
      ...(goal
        ? [
            {
              id: "goal",
              kind: "goal" as const,
              location: goal,
              title: trail.goal_name ?? trail.name,
              lines: [`Cieľ výletu · ${GOAL_LABEL[goalKind]}`],
              colour: GOAL_COLOUR[goalKind],
              icon: kindSvg(goalKind, 16),
              active: true,
            },
          ]
        : []),
    ],
    [trailheads, parkingLots, choice, choose, stops, stopChoice, chooseStop, homeStop, pois, transit, goal, goalKind, trail.goal_name, trail.name]
  );

  // Opens on the trail and where the car stops. The drive is drawn too, but a long drive would
  // shrink the trail to a speck (testers), so it isn't fitted: zoom out to see it.
  // Fitted once per start and way of travel: picking another parking keeps the view where it is.
  const baseKey = `${start?.lat},${start?.lon},${transit},${trail.slug}`;
  const [driveFitFor, setDriveFitFor] = useState<string | null>(null);
  if (drive.route && driveFitFor !== baseKey) setDriveFitFor(baseKey);
  const fitKey = `${baseKey},${driveFitFor === baseKey}`;
  const bounds = useMemo<BBox | null>(() => {
    const pts: [number, number][] = [];
    if (carStop) pts.push(pair(carStop));
    // The trail itself: switching to another route glides over to it (the others stay drawn around it).
    if (trail.bbox) pts.push(pair(trail.bbox.sw), pair(trail.bbox.ne));
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
      onHoverTrail={others.length ? (slug) => setHoveredRoute(others.some((o) => o.slug === slug) ? slug : null) : undefined}
      ariaLabel="Mapa trasy"
      tapOnly={tapOnly}
    />
  );
}
