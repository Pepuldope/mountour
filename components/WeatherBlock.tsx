"use client";

import { useState } from "react";
import type { DayPlan } from "@/lib/dayPlan";
import { useCachedJson } from "@/lib/useDriveRoute";
import { FORECAST_DAYS, summarize, tripWeatherReport, weatherNotes, weatherWords } from "@/lib/weather";
import type { WeatherForecast, WeatherSummary } from "@/lib/weather";
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
export function WeatherReport({ plan, weather, goal, wholeDay }: { plan: DayPlan; weather: TripWeather; goal: Goal; wholeDay: boolean }) {
  if (weather.loading) return <p className="text-xs text-[var(--muted)]">Načítavam predpoveď počasia...</p>;
  if (!weather.below) return null;
  const from = wholeDay ? plan.segments[0].start : plan.hikeStart;
  const to = wholeDay ? plan.segments[plan.segments.length - 1].end : plan.hikeEnd;
  const r = tripWeatherReport(weather.below, weather.above, from, to, { from: plan.hikeStart, to: plan.hikeEnd });
  if (!r) return null;
  const notes = weatherNotes(weather.below, weather.above, plan.hikeStart, plan.hikeEnd);
  const stormy = notes.some((n) => n.strong);
  const temps = r.tempMin === r.tempMax ? `${r.tempMin} °C` : `${r.tempMin} až ${r.tempMax} °C`;

  return (
    <section aria-label="Počasie" className="flex flex-col gap-1.5 text-sm">
      <p>
        <span className="font-semibold">Počasie {wholeDay ? "počas výletu" : "počas túry"}:</span> {temps}
        {r.topMin !== null && goal ? `, ${goal.name} až ${r.topMin} °C` : ""}
        {/* Rain, snow and storms get their own warning lines below. */}
        {r.wet ? "." : r.worstWhen ? `, najhoršie ${r.worst} ${r.worstWhen}.` : `, ${r.worst}.`}
      </p>
      {r.wet && !stormy && (
        <p className="font-semibold text-[var(--warn)]">
          {r.wet.snow ? "Môže snežiť" : "Môže pršať"} {r.wet.when}
          {r.wet.mmPerHour >= 0.1 ? ` (${r.wet.mmPerHour < 0.5 ? "slabo" : r.wet.mmPerHour < 2 ? "mierne" : "výdatne"}, do ${mm(r.wet.mmPerHour)} mm/h)` : ""}. Vezmite si nepremokavú bundu.
        </p>
      )}
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
