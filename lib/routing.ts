// Server-side routing calls shared by /api/drive and /api/walk.
//
// OpenRouteService when ORS_API_KEY is set (production; the key stays on the
// server). Without a key, the public OSRM demo (car) and FOSSGIS (foot)
// servers, which are fine for local development but have no SLA.
import type { DriveRoute } from "@/lib/drive";
import { haversineM, nearestOnPath } from "@/lib/geo";

export type Pt = [number, number];
type OrsProfile = "driving-car" | "foot-hiking" | "foot-walking";

const DAY_S = 86400;

/** GeoJSON [lon, lat] -> our [lat, lon]. */
const flip = (coords: Pt[]): Pt[] => coords.map(([lon, lat]) => [lat, lon]);

export async function viaOrs(key: string, profile: OrsProfile, from: Pt, to: Pt, radiuses: [number, number]): Promise<DriveRoute> {
  // POST so we can lift the 350 m snapping limit for points off the network.
  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: { Authorization: key, Accept: "application/geo+json", "Content-Type": "application/json" },
    body: JSON.stringify({
      coordinates: [
        [from[1], from[0]],
        [to[1], to[0]],
      ],
      radiuses,
    }),
  });
  if (!res.ok) throw new Error(`ORS ${profile} ${res.status}`);
  const f = (await res.json()).features?.[0];
  if (!f) throw new Error(`ORS ${profile}: no route`);
  return {
    durationMin: Math.round(f.properties.summary.duration / 60),
    distanceM: Math.round(f.properties.summary.distance),
    points: flip(f.geometry.coordinates),
  };
}

export async function viaOsrm(base: string, from: Pt, to: Pt): Promise<DriveRoute> {
  const url = `${base}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  const res = await fetch(url, { next: { revalidate: DAY_S } } as RequestInit);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r) throw new Error(`OSRM: ${data.code}`);
  return {
    durationMin: Math.round(r.duration / 60),
    distanceM: Math.round(r.distance),
    points: flip(r.geometry.coordinates),
  };
}

const OSRM_CAR = "https://router.project-osrm.org";
const FOSSGIS_FOOT = "https://routing.openstreetmap.de/routed-foot";

export function driveRoute(key: string | undefined, from: Pt, to: Pt, snapM: number): Promise<DriveRoute> {
  return key ? viaOrs(key, "driving-car", from, to, [snapM, snapM]) : viaOsrm(OSRM_CAR, from, to);
}

/**
 * On foot between two public places. Hiking paths first; if that finds no
 * way (a parking off the path network), plain walking, which also uses minor
 * roads and tracks.
 */
export async function walkRoute(key: string | undefined, from: Pt, to: Pt, snapM: number): Promise<DriveRoute> {
  if (!key) return viaOsrm(FOSSGIS_FOOT, from, to);
  try {
    return await viaOrs(key, "foot-hiking", from, to, [snapM, snapM]);
  } catch (err) {
    console.warn("walk: foot-hiking failed, trying foot-walking", err);
    return viaOrs(key, "foot-walking", from, to, [snapM, snapM]);
  }
}

const dist = (a: Pt, b: Pt) => haversineM({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] });

/** Past this, the road route stopped short of the parking (it snapped to another road). */
export const GAP_M = 80;
/** Forest roads and tracks to a trailhead parking: about this fast. */
const LAST_STRETCH_KMH = 20;

/**
 * The car router snaps a parking off its road network (a forest road, a
 * track, a lot inside a field) to the nearest road it knows, which can be
 * far away, and the line would then jump straight to the parking. Follow the
 * real ways for that last stretch with the foot router (it knows tracks and
 * minor roads) and add it to the drive at a slow pace.
 */
export async function finishDrive(route: DriveRoute, to: Pt, tail: (from: Pt, to: Pt) => Promise<DriveRoute>): Promise<DriveRoute> {
  const end = route.points[route.points.length - 1];
  if (!end) return route;
  const gap = dist(end, to);
  if (gap <= GAP_M) return route;
  try {
    const last = await tail(end, to);
    // A detour much longer than the gap is a wrong turn, not the way in.
    if (last.distanceM > Math.max(3 * gap, gap + 1500)) return route;
    const trimmed = dropDeadEnd(route, last);
    const walk = trimmed.tail;
    return {
      durationMin: trimmed.drive.durationMin + Math.max(1, Math.round((walk.distanceM / 1000 / LAST_STRETCH_KMH) * 60)),
      distanceM: trimmed.drive.distanceM + walk.distanceM,
      points: [...trimmed.drive.points, ...walk.points],
    };
  } catch (err) {
    console.warn("drive: last stretch to the parking failed", err);
    return route;
  }
}

/** A tail point this close to the drive is still on the road the car came in by. */
const SAME_WAY_M = 20;

const lineM = (pts: Pt[]) => pts.reduce((sum, p, i) => (i ? sum + dist(pts[i - 1], p) : 0), 0);

/**
 * The car router ends at the road point nearest the parking, which can be
 * down a dead end the walk then has to come back out of. Where the walk
 * starts by retracing the drive, stop the car where the walk leaves the road
 * and drop both copies of that stretch.
 */
export function dropDeadEnd(drive: DriveRoute, tail: DriveRoute): { drive: DriveRoute; tail: DriveRoute } {
  const road = drive.points.map(([lat, lon]) => ({ lat, lon }));
  let cut: { i: number; point: { lat: number; lon: number } } | null = null;
  let k = 0;
  for (let t = 1; t < tail.points.length; t++) {
    const [lat, lon] = tail.points[t];
    const hit = nearestOnPath(road.slice(0, (cut?.i ?? road.length - 1) + 2), { lat, lon });
    if (!hit || hit.distanceM > SAME_WAY_M) break;
    cut = hit;
    k = t;
  }
  if (!cut || k === 0) return { drive, tail };
  const at: Pt = [cut.point.lat, cut.point.lon];
  const kept: Pt[] = [...drive.points.slice(0, cut.i + 1), at];
  const keptM = lineM(kept);
  const fullM = lineM(drive.points);
  const share = fullM > 0 ? keptM / fullM : 1;
  const rest: Pt[] = [at, ...tail.points.slice(k + 1)];
  const restM = lineM(rest);
  const tailM = lineM(tail.points);
  return {
    drive: {
      durationMin: Math.round(drive.durationMin * share),
      distanceM: Math.round(drive.distanceM * share),
      points: kept,
    },
    tail: {
      durationMin: tail.durationMin,
      distanceM: tailM > 0 ? Math.round(tail.distanceM * (restM / tailM)) : tail.distanceM,
      points: rest,
    },
  };
}

/**
 * Fewer points with the shape kept (Douglas-Peucker, `tolM` metres): a long
 * drive stays light to send and draw, and still follows every bend when zoomed in.
 */
export function simplifyLine(points: Pt[], tolM: number): Pt[] {
  if (points.length <= 2) return points;
  const lat0 = points[0][0];
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  const xy = points.map(([lat, lon]) => [lon * kx, lat * ky]);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let far = -1;
    let farD = tolM;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      const d = len > 0 ? Math.abs(dy * (px - ax) - dx * (py - ay)) / len : Math.hypot(px - ax, py - ay);
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
