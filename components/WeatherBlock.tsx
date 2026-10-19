"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { DayPlan } from "@/lib/dayPlan";
import { useCachedJson } from "@/lib/useDriveRoute";
import { dayInSentence, isoDate } from "@/lib/days";
import { FORECAST_DAYS, betterDay, summarize, tripWeatherReport, weatherNotes, weatherWords } from "@/lib/weather";
import type { BetterDay, WeatherForecast, WeatherSummary } from "@/lib/weather";
import { badSkySvg } from "@/lib/weatherIcons";
import type { LatLng } from "@/lib/types";

type Goal = (LatLng & { ele: number | null; name: string }) | null;

const DAY = 86400000;

function url(p: LatLng, alt?: number | null): string {
  return `/api/weather?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}${alt ? `&alt=${Math.round(alt)}` : ""}`;
}

function temps(s: WeatherSummary): string {
  return s.tempMin === s.tempMax ? `${s.tempMin} °C` : `${s.tempMin} až ${s.tempMax} °C`;
}

export interface TripWeather {
  /** At the trail start (asked for at its height when known); null until loaded or out of range. */
  below: WeatherForecast | null;
  /** Up at the goal, for its height. */
  above: WeatherForecast | null;
  loading: boolean;
}

/** The forecast for the day of the walk, at the start and up at the goal; nothing beyond the forecast range. */
export function useTripWeather(plan: DayPlan | null, start: LatLng | null, goal: Goal, startEle: number | null): TripWeather {
  const [now] = useState(() => Date.now());
  const inRange = !!plan && !!start && plan.hikeStart.getTime() - now < FORECAST_DAYS * DAY && plan.hikeEnd.getTime() > now;
  const below = useCachedJson<WeatherForecast>(inRange ? url(start!, startEle) : null);
  const above = useCachedJson<WeatherForecast>(inRange && goal?.ele ? url(goal, goal.ele) : null);
  return { below: below.data, above: above.data, loading: below.status === "loading" };
}

/**
 * One line on the weather during the walk and short warnings under the sun
 * dial (which draws the weather itself). Severe weather gets a red line,
 * wind and frost an amber one, like the sunset notes.
 */
export function WeatherNotes({ plan, weather, goal }: { plan: DayPlan; weather: TripWeather; goal: Goal }) {
  if (weather.loading) return <p className="text-xs text-[var(--muted)]">Načítavam predpoveď počasia...</p>;
  if (!weather.below) return null;
  const atStart = summarize(weather.below, plan.hikeStart, plan.hikeEnd);
  if (!atStart) return null;
  const atGoal = weather.above ? summarize(weather.above, plan.hikeStart, plan.hikeEnd) : null;
  const notes = weatherNotes(weather.below, weather.above, plan.hikeStart, plan.hikeEnd);

  return (
    <section aria-label="Počasie počas túry" className="flex flex-col gap-1.5 text-sm">
      <p className="text-[var(--muted)]">
        Počas túry {weatherWords(atStart.symbol)}, {temps(atStart)}
        {atGoal && goal && atGoal.tempMin < atStart.tempMin - 1 ? `, ${goal.name} ${temps(atGoal)}` : ""}
        {atStart.rainMm >= 0.2 ? `, zrážky ${String(atStart.rainMm).replace(".", ",")} mm` : ""}.
      </p>
      {notes.map((n) =>
        n.strong ? (
          <p key={n.text} className="rounded-xl bg-[var(--danger-bg)] px-3 py-2 font-semibold text-[var(--danger)]">
            {n.text}
          </p>
        ) : (
          <p key={n.text} className="font-semibold text-[var(--warn)]">
            {n.text}
          </p>
        )
      )}
    </section>
  );
}

const mm = (n: number) => String(n).replace(".", ",");

/**
 * Everything the forecast says about the trip, under the day: the whole
 * temperature range, the worst weather and when, a note for any rain at all
 * (even one light hour), and the storm, wind and frost warnings. By bus the
 * window is the whole day out, since waiting at a stop is outdoors too.
 */
export function WeatherReport({
  plan,
  weather,
  goal,
  wholeDay,
  onPickDay,
}: {
  plan: DayPlan;
  weather: TripWeather;
  goal: Goal;
  wholeDay: boolean;
  /** Moves the trip to another day (YYYY-MM-DD), for the drier-day suggestion. */
  onPickDay?: (iso: string) => void;
}) {
  if (weather.loading) return <p className="text-xs text-[var(--muted)]">Načítavam predpoveď počasia...</p>;
  if (!weather.below) return null;
  const from = wholeDay ? plan.segments[0].start : plan.hikeStart;
  const to = wholeDay ? plan.segments[plan.segments.length - 1].end : plan.hikeEnd;
  const r = tripWeatherReport(weather.below, weather.above, from, to, { from: plan.hikeStart, to: plan.hikeEnd });
  if (!r) return null;
  const notes = weatherNotes(weather.below, weather.above, plan.hikeStart, plan.hikeEnd);
  const stormy = notes.some((n) => n.strong);
  const temps = r.tempMin === r.tempMax ? `${r.tempMin} °C` : `${r.tempMin} až ${r.tempMax} °C`;
  // A wet or stormy walk always gets a next step: the nearest dry day in the forecast, same start time.
  const better = onPickDay ? betterDay(weather.below, weather.above, plan.hikeStart, plan.hikeEnd, new Date()) : null;

  return (
    <section aria-label="Počasie" className="flex flex-col gap-1.5 text-sm">
      <p>
        <span className="font-semibold">Počasie {wholeDay ? "počas výletu" : "počas túry"}:</span> {temps}
        {r.topMin !== null && goal ? `, ${goal.name} až ${r.topMin} °C` : ""}
        {/* Rain, snow and storms get their own warning lines below. */}
        {r.wet ? "." : r.worstWhen ? `, najhoršie ${r.worst} ${r.worstWhen}.` : `, ${r.worst}.`}
      </p>
      {/* Warnings in a box with a sign (Peter: plain coloured text was easy to overlook). */}
      {r.wet && !stormy && (
        <Warning kind={r.wet.snow ? "snow" : "rain"}>
          {r.wet.snow ? "Môže snežiť" : "Môže pršať"} {r.wet.when}
          {r.wet.mmPerHour >= 0.1 ? ` (${r.wet.mmPerHour < 0.5 ? "slabo" : r.wet.mmPerHour < 2 ? "mierne" : "výdatne"}, do ${mm(r.wet.mmPerHour)} mm/h)` : ""}. Vezmite si nepremokavú bundu.
        </Warning>
      )}
      {notes.map((n) => (
        <Warning key={n.text} kind={n.strong ? "storm" : "warn"}>
          {n.text}
        </Warning>
      ))}
      {better && <BetterDayTip better={better} hikeStart={plan.hikeStart} onPickDay={onPickDay!} />}
    </section>
  );
}

const SIGN: Record<"rain" | "snow" | "storm" | "warn", string> = {
  rain: badSkySvg("rain", false),
  snow: badSkySvg("snow", false),
  storm: badSkySvg("thunder", false),
  warn: '<path d="M12 3 22 20H2z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 9.5v4.5M12 16.8v.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
};

/** A weather warning: a coloured box with a thick edge and its sign; storms in red, the rest amber. */
function Warning({ kind, children }: { kind: keyof typeof SIGN; children: ReactNode }) {
  const red = kind === "storm";
  return (
    <p
      className={`flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 font-semibold ${
        red ? "border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger)]" : "border-[var(--warn)] bg-[var(--warn-bg)] text-[var(--warn)]"
      }`}
    >
      {/* Constant markup (lib/weatherIcons.ts and the triangle above). */}
      <svg viewBox="0 0 24 24" className="mt-px h-6 w-6 shrink-0" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SIGN[kind] }} />
      <span>{children}</span>
    </p>
  );
}

/** "Lepšie vyzerá v nedeľu: polojasno, 7 až 11 °C, bez zrážok." and a button that moves the plan there. */
function BetterDayTip({ better, hikeStart, onPickDay }: { better: BetterDay; hikeStart: Date; onPickDay: (iso: string) => void }) {
  const iso = isoDate(new Date(hikeStart.getFullYear(), hikeStart.getMonth(), hikeStart.getDate() + better.offset));
  const when = dayInSentence(iso, new Date());
  const s = better.summary;
  const temps = s.tempMin === s.tempMax ? `${s.tempMin} °C` : `${s.tempMin} až ${s.tempMax} °C`;
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl bg-[var(--accent-soft)] px-3 py-2.5">
      <p>
        <span className="font-semibold">Lepšie vyzerá {when}:</span> {weatherWords(s.symbol)}, {temps}, bez zrážok.
      </p>
      <button
        type="button"
        onClick={() => onPickDay(iso)}
        className="rounded-[10px] bg-[var(--accent)] px-3 py-2 text-sm font-bold text-[var(--accent-contrast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {/* "v nedeľu 1. 11." -> "Prepnúť na nedeľu" */}
        Prepnúť na {when.replace(/^vo? /, "").replace(/ \d.*$/, "")}
      </button>
    </div>
  );
}
