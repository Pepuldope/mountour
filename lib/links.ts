/**
 * Everything that leaves MounTour as a link or a message: the shared plan,
 * navigation hand-offs (Google Maps, Mapy.com) and the cp.sk timetable search.
 * Pure, so the wording and parameters are unit tested.
 */
import { DIFFICULTY_LABEL, formatDuration } from "@/lib/format";
import { haversineM } from "@/lib/geo";
import type { LatLng } from "@/lib/types";
import type { StartPoint } from "@/lib/userLocation";

/** The start as a town name for sharing; null for an unnamed GPS fix (we never share coordinates). */
export function startTown(start: Pick<StartPoint, "label" | "source"> | null, gpsTown?: string | null): string | null {
  if (!start) return null;
  if (start.source === "gps") return gpsTown ?? null;
  return start.label.split(",")[0].trim() || null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${d.getHours()}:${pad(d.getMinutes())}`;

/** Query keys of a shared plan: /trasa/pajstun?den=2026-10-17&odchod=08:50&z=Bratislava */
export const SHARE_PARAMS = { date: "den", time: "odchod", from: "z" } as const;

export function sharePath(slug: string, date: string, time: string, town: string | null): string {
  const q = new URLSearchParams({ [SHARE_PARAMS.date]: date, [SHARE_PARAMS.time]: time });
  if (town) q.set(SHARE_PARAMS.from, town);
  return `/trasa/${slug}?${q.toString()}`;
}

export interface SharedPlan {
  date: string;
  time: string;
  town: string | null;
}

/** Reads a shared plan from a query string; null unless both day and time are valid. */
export function readSharedPlan(search: string): SharedPlan | null {
  const q = new URLSearchParams(search);
  const date = q.get(SHARE_PARAMS.date) ?? "";
  const time = q.get(SHARE_PARAMS.time) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const town = q.get(SHARE_PARAMS.from)?.slice(0, 60).trim() || null;
  return { date, time, town };
}

export interface ShareTextInput {
  name: string;
  /** "sobota 17. 10." */
  dayLabel: string;
  departure: Date;
  /** Back at the start (with a drive) or off the trail (without). */
  back: Date;
  hasDrive: boolean;
  /** The hike ends before sunset. Otherwise the message warns instead of promising daylight. */
  inDaylight: boolean;
  town: string | null;
  hikeMin: number;
  difficulty: keyof typeof DIFFICULTY_LABEL;
  familyFriendly: boolean;
  url: string;
}

/** Chat-ready plan in the voice guide's style: facts first, one line each. */
export function shareText(i: ShareTextInput): string {
  const light = i.inDaylight ? ", ešte za svetla." : ". Pozor, z túry zídete až po západe slnka.";
  const leave = i.hasDrive
    ? `${i.town ? `Štart ${i.town}, odchod` : "Odchod"} ${hhmm(i.departure)}, späť okolo ${hhmm(i.back)}${light}`
    : `Začiatok túry ${hhmm(i.departure)}, dole okolo ${hhmm(i.back)}${light}`;
  const facts = [
    `${formatDuration(i.hikeMin).replaceAll("\u00a0", " ")} chôdze`,
    DIFFICULTY_LABEL[i.difficulty].toLowerCase(),
    ...(i.familyFriendly ? ["vhodné pre deti"] : []),
  ].join(", ");
  return `${i.name}, ${i.dayLabel}\n${leave}\n${facts}.\n${i.url}`;
}

export function googleMapsUrl(to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lon}&travelmode=driving`;
}

/** The walk itself, as the trip page hands it to a maps app: [lat, lon] points of the trail. */
export interface WalkRoute {
  /** Way up only for "tam-a-spat" (back the same way); the whole loop for "okruh". */
  points: [number, number][];
  loop: boolean;
}

/** `n` points spread evenly by distance along `pts`, ends excluded. */
function spread(pts: LatLng[], n: number): LatLng[] {
  if (pts.length < 2 || n <= 0) return [];
  const along = [0];
  for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + haversineM(pts[i - 1], pts[i]));
  const total = along[along.length - 1];
  const out: LatLng[] = [];
  let i = 0;
  for (let k = 1; k <= n; k++) {
    const want = (total * k) / (n + 1);
    while (i < pts.length - 1 && along[i + 1] < want) i++;
    out.push(pts[Math.min(i + 1, pts.length - 1)]);
  }
  return out;
}

/** The walk from where it joins the trail: parked up the trail, a there-and-back starts there and a loop is walked round from there. */
function walkedPart(walk: WalkRoute, join: LatLng | null): LatLng[] {
  const pts = walk.points.map(([lat, lon]) => ({ lat, lon }));
  if (!join || pts.length < 2) return pts;
  let at = 0;
  pts.forEach((p, i) => {
    if (haversineM(p, join) < haversineM(pts[at], join)) at = i;
  });
  return walk.loop ? [...pts.slice(at), ...pts.slice(1, at + 1)] : pts.slice(at);
}

/**
 * Points a maps app must pass so its walking route keeps to our trail: from the car
 * (or the stop) over the trail to the goal and, for loops, round to the start again.
 * There-and-back trails end at the goal (back the same way) unless `roundTrip`, which
 * repeats the way up in reverse so the app also routes the way back.
 */
export function walkStops(walk: WalkRoute, join: LatLng | null, max: number, roundTrip: boolean): { via: LatLng[]; end: LatLng | "start" } {
  const pts = walkedPart(walk, join);
  if (pts.length < 2) return { via: [], end: pts[0] ?? "start" };
  if (walk.loop) return { via: spread(pts, max), end: "start" };
  const goal = pts[pts.length - 1];
  if (!roundTrip) return { via: spread(pts, max), end: goal };
  const up = spread(pts, Math.floor((max - 1) / 2));
  return { via: [...up, goal, ...[...up].reverse()], end: "start" };
}

const g = (x: LatLng) => `${x.lat.toFixed(5)},${x.lon.toFixed(5)}`;
const m = (x: LatLng) => `${x.lon.toFixed(5)},${x.lat.toFixed(5)}`;

/**
 * Google Maps walking directions over the trail. Google opens a link on a phone with at
 * most 3 stops, so it gets 3 points to the goal and the app picks its own paths between them.
 */
export function googleWalkUrl(from: LatLng, walk: WalkRoute, join: LatLng | null): string {
  const { via, end } = walkStops(walk, join, 3, false);
  const dest = end === "start" ? from : end;
  const q = `&waypoints=${via.map(g).join("%7C")}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${g(from)}&destination=${g(dest)}${via.length ? q : ""}&travelmode=walking`;
}

/** Mapy.com hiking route (keeps to marked trails), up to 15 stops: the whole walk, back at the car. */
export function mapyWalkUrl(from: LatLng, walk: WalkRoute, join: LatLng | null): string {
  const { via, end } = walkStops(walk, join, 15, true);
  const dest = end === "start" ? from : end;
  const q = via.length ? `&waypoints=${via.map(m).join(";")}` : "";
  return `https://mapy.com/fnc/v1/route?mapset=outdoor&start=${m(from)}&end=${m(dest)}${q}&routeType=foot_hiking&navigate=true`;
}

/** Google Maps public transport directions; the app then lists the buses, trains and changes. */
export function googleTransitUrl(to: LatLng, from: LatLng | null): string {
  const origin = from ? `&origin=${from.lat},${from.lon}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${to.lat},${to.lon}&travelmode=transit`;
}

/** Apple Maps public transport directions (dirflg=r); opens the Maps app on iPhone and Mac. */
export function appleTransitUrl(to: LatLng, from: LatLng | null): string {
  const saddr = from ? `saddr=${from.lat},${from.lon}&` : "";
  return `https://maps.apple.com/?${saddr}daddr=${to.lat},${to.lon}&dirflg=r`;
}

/** Mapy.com URL API (lon,lat order): a car route when the start is known, else the spot with a pin. */
export function mapyUrl(to: LatLng, from: LatLng | null): string {
  const p = (x: LatLng) => `${x.lon.toFixed(5)},${x.lat.toFixed(5)}`;
  return from
    ? `https://mapy.com/fnc/v1/route?mapset=outdoor&start=${p(from)}&end=${p(to)}&routeType=car_fast&navigate=true`
    : `https://mapy.com/fnc/v1/showmap?mapset=outdoor&center=${p(to)}&zoom=16&marker=true`;
}

/**
 * cp.sk (official SK train/bus search), prefilled with from, to, day and time.
 * `arrive`: the time is when you want to be there (cp.sk "príchod"), not when you leave.
 */
export function cpSkUrl(
  to: string,
  from: string | null,
  date: string | null,
  time: string | null,
  arrive = false
): string {
  const q = new URLSearchParams();
  if (from) q.set("f", from);
  q.set("t", to);
  if (date) {
    const [y, m, d] = date.split("-").map(Number);
    q.set("date", `${d}.${m}.${y}`);
  }
  if (time) q.set("time", time);
  if (arrive) q.set("arr", "true");
  return `https://cp.sk/vlakbusmhd/spojenie/?${q.toString()}`;
}

/** The way back: from the stop to home, leaving after you are off the trail. */
export function cpSkBackUrl(stop: string, home: string | null, date: string | null, after: string | null): string {
  const q = new URLSearchParams();
  q.set("f", stop);
  if (home) q.set("t", home);
  if (date) {
    const [y, m, d] = date.split("-").map(Number);
    q.set("date", `${d}.${m}.${y}`);
  }
  if (after) q.set("time", after);
  return `https://cp.sk/vlakbusmhd/spojenie/?${q.toString()}`;
}
