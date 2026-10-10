/**
 * Everything that leaves MounTour as a link or a message: the shared plan,
 * navigation hand-offs (Google Maps, Mapy.com) and the cp.sk timetable search.
 * Pure, so the wording and parameters are unit tested.
 */
import { DIFFICULTY_LABEL, formatDuration } from "@/lib/format";
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
    `${formatDuration(i.hikeMin)} chôdze`,
    DIFFICULTY_LABEL[i.difficulty].toLowerCase(),
    ...(i.familyFriendly ? ["vhodné pre deti"] : []),
  ].join(", ");
  return `${i.name}, ${i.dayLabel}\n${leave}\n${facts}.\n${i.url}`;
}

export function googleMapsUrl(to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lon}&travelmode=driving`;
}

/** Mapy.com URL API (lon,lat order): a car route when the start is known, else the spot with a pin. */
export function mapyUrl(to: LatLng, from: LatLng | null): string {
  const p = (x: LatLng) => `${x.lon.toFixed(5)},${x.lat.toFixed(5)}`;
  return from
    ? `https://mapy.com/fnc/v1/route?mapset=outdoor&start=${p(from)}&end=${p(to)}&routeType=car_fast&navigate=true`
    : `https://mapy.com/fnc/v1/showmap?mapset=outdoor&center=${p(to)}&zoom=16&marker=true`;
}

/** cp.sk (official SK train/bus search), prefilled with from, to, day and time. */
export function cpSkUrl(to: string, from: string | null, date: string | null, time: string | null): string {
  const q = new URLSearchParams();
  if (from) q.set("f", from);
  q.set("t", to);
  if (date) {
    const [y, m, d] = date.split("-").map(Number);
    q.set("date", `${d}.${m}.${y}`);
  }
  if (time) q.set("time", time);
  return `https://cp.sk/vlakbusmhd/spojenie/?${q.toString()}`;
}
