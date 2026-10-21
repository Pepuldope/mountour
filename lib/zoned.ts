/**
 * Slovak wall-clock time, whatever the device's timezone. Sun times are
 * absolute instants; departures, train times and everything printed are
 * Slovak clock times. Built on the device zone, a phone set to London or a
 * laptop in Thailand moved every "vyrazte do" by the offset, so every
 * wall-clock date is built and read here instead of with Date's local getters.
 */
export const TZ = "Europe/Bratislava";

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

export interface WallClock {
  y: number;
  /** 1-12 */
  mo: number;
  d: number;
  h: number;
  mi: number;
  /** Seconds, for the offset; times shown never need them. */
  s: number;
}

// Home lists ask for the same few instants thousands of times per render.
const memo = new Map<number, WallClock>();

/** The Slovak calendar date and clock time of an instant. */
export function wallClock(at: Date | number): WallClock {
  const t = typeof at === "number" ? at : at.getTime();
  const hit = memo.get(t);
  if (hit) return hit;
  const p: Record<string, number> = {};
  for (const { type, value } of parts.formatToParts(t)) if (type !== "literal") p[type] = Number(value);
  const out = { y: p.year, mo: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second };
  if (memo.size > 2000) memo.clear();
  memo.set(t, out);
  return out;
}

/** Milliseconds Slovak time is ahead of UTC at this instant (3,600,000 in winter, 7,200,000 in summer). */
function offsetAt(t: number): number {
  const w = wallClock(t);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(t / 1000) * 1000;
}

/**
 * The instant of a Slovak wall-clock time. Like Date's constructor, the day
 * and minutes may overflow (day 32, minute 1500). On the spring clock change
 * the missing 02:xx lands an hour later; on the autumn one 02:xx is the first
 * (summer time) of the two. Only night trains ever ask for those.
 */
export function zonedDate(y: number, mo: number, d: number, h = 0, mi = 0): Date {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // The offset half a day either side: the same, except around a clock change.
  const before = wall - offsetAt(wall - 12 * 3600000);
  const after = wall - offsetAt(wall + 12 * 3600000);
  const fits = (t: number) => t + offsetAt(t) === wall;
  if (fits(before)) return new Date(before);
  if (fits(after)) return new Date(after);
  return new Date(before);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "08:05", Slovak time. */
export function clock(at: Date | number): string {
  const w = wallClock(at);
  return `${pad(w.h)}:${pad(w.mi)}`;
}

/** "8:05", Slovak time: the form used in running text. */
export function clockShort(at: Date | number): string {
  const w = wallClock(at);
  return `${w.h}:${pad(w.mi)}`;
}

/** Hour of the day in Slovakia, 0-23. */
export function hourOf(at: Date | number): number {
  return wallClock(at).h;
}
