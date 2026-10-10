"use client";

import { useEffect, useState } from "react";
import { SAFE_MARGIN_MIN } from "@/lib/dayPlan";
import { dayInSentence, floorTo5, longDay } from "@/lib/days";
import { formatDuration, formatTime, verdictText } from "@/lib/format";
import { googleMapsUrl, mapyUrl, readSharedPlan } from "@/lib/links";
import type { SharedPlan } from "@/lib/links";
import { useTripSettings } from "@/lib/tripSettings";
import { useTripPlan } from "@/lib/useTripPlan";
import { useUserLocation } from "@/lib/userLocation";
import type { BBox, LatLng } from "@/lib/types";
import { FilterChips } from "@/components/FilterChips";
import { SaveTripButton } from "@/components/SaveTripButton";
import type { ShareInfo } from "@/components/ShareButton";
import { StartChip } from "@/components/StartChip";
import { TimelineBar } from "@/components/TimelineBar";

interface Props extends ShareInfo {
  sun: LatLng | null;
  destination: LatLng | null;
  baseHikeMin: number;
  gpxUrl: string | null;
  bbox: BBox | null;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const navButton =
  "flex-1 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 text-center text-sm font-semibold hover:border-[var(--accent)]";

/**
 * The trip page's answer: "vyrazte najneskôr", the day and departure, the
 * timeline, then Uložiť (main), share and navigation hand-offs.
 */
export function TripPlanner({ sun, destination, baseHikeMin, gpxUrl, bbox, ...trip }: Props) {
  const { start } = useUserLocation();
  const { today, update } = useTripSettings();
  const { plan, date, time, driveMin, driveApprox, driveStatus } = useTripPlan(sun, destination, baseHikeMin);
  const [shared, setShared] = useState<SharedPlan | null>(null);

  // A shared link opens the sender's day and departure (once, then it's ours to change).
  useEffect(() => {
    const fromLink = readSharedPlan(window.location.search);
    if (!fromLink || !today || fromLink.date < today) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShared(fromLink);
    update({ date: fromLink.date, time: fromLink.time });
    window.history.replaceState(null, "", window.location.pathname);
  }, [today, update]);

  const hasDrive = driveMin !== null;
  const good = plan?.verdict === "ok";
  const startName = start?.label.split(",")[0];
  const latest = plan ? floorTo5(plan.latestStart) : null;
  const latestPassed = latest && date === today && latest < new Date();

  return (
    <div className="flex flex-col gap-4">
      {shared && (
        <div className="rounded-[var(--radius-card)] bg-[var(--sky-night)] p-4 text-sm text-white">
          <p>
            Plán od kamaráta: <strong>{longDay(shared.date)}</strong>, odchod{" "}
            <strong className="font-data text-base">{shared.time}</strong>
            {shared.town ? `, štart ${shared.town}` : ""}.
          </p>
          <p className="opacity-80">Nižšie je prepočítaný z vášho miesta.</p>
        </div>
      )}

      {plan && (
        <section
          aria-label="Kedy vyraziť"
          className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-[var(--sky-night)] p-4 text-white"
        >
          <p className="text-sm opacity-90">
            {startName && hasDrive ? `Štart ${startName} · ` : ""}
            {capitalize(`${date ? `${dayInSentence(date, new Date())} ` : ""}${hasDrive ? "vyrazte" : "začnite túru"} najneskôr`)}
          </p>
          <p className="font-data text-5xl leading-none text-[var(--sun)]">{formatTime(latest!)}</p>
          <p className="text-sm opacity-90">
            aby ste boli dole {SAFE_MARGIN_MIN} min pred západom slnka ({formatTime(plan.sunset)})
          </p>
          {latestPassed && (
            <p className="pt-1 text-sm text-[var(--sun)]">Na dnes je to už neskoro. Skúste zajtra ráno.</p>
          )}
          {driveApprox && (
            <p className="pt-1 text-xs opacity-80">Cestu autom teraz odhadujeme podľa vzdialenosti (~{formatDuration(driveMin!)}).</p>
          )}
          {!start && <p className="pt-1 text-xs opacity-80">Vyberte, odkiaľ vyrážate, a pridáme aj cestu autom.</p>}
        </section>
      )}

      <section aria-label="Deň a odchod" className="flex flex-col gap-3">
        <StartChip />
        <FilterChips variant="trip" activeDate={date} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            {hasDrive ? "Odchod" : "Začiatok túry"}
            <input
              type="time"
              step={300}
              value={time ?? ""}
              onChange={(e) => e.target.value && update({ time: e.target.value })}
              className="font-data w-32 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1.5 text-lg"
            />
          </label>
          {latest && !latestPassed && time !== hhmm(latest) && (
            <button
              type="button"
              onClick={() => update({ time: hhmm(latest) })}
              className="text-sm font-semibold text-[var(--accent)] underline"
            >
              najneskôr ({formatTime(latest)})
            </button>
          )}
        </div>
        {driveStatus === "loading" && <p className="text-xs text-[var(--muted)]">Počítam cestu autom...</p>}
      </section>

      {plan && (
        <section aria-label="Priebeh dňa" className="flex flex-col gap-3">
          <TimelineBar plan={plan} good={good} hasDrive={hasDrive} />
          <p role="status" className={`text-sm font-semibold ${good ? "text-[var(--ok)]" : "text-[var(--warn)]"}`}>
            {verdictText(plan)}
          </p>
          {plan.startsInDark && <p className="text-sm text-[var(--warn)]">Túra začína pred východom slnka, vezmite si čelovku.</p>}
          <ol className="font-data grid grid-cols-2 gap-x-4 gap-y-0.5 text-[15px] sm:grid-cols-4">
            {hasDrive && (
              <li>
                <span className="text-[var(--muted)]">odchod</span> {formatTime(plan.segments[0].start)}
              </li>
            )}
            <li>
              <span className="text-[var(--muted)]">túra</span> {formatTime(plan.hikeStart)}
            </li>
            <li>
              <span className="text-[var(--muted)]">dole</span> {formatTime(plan.hikeEnd)}
            </li>
            {hasDrive && (
              <li>
                <span className="text-[var(--muted)]">doma</span> {formatTime(plan.segments[plan.segments.length - 1].end)}
              </li>
            )}
          </ol>
        </section>
      )}

      <section aria-label="Uložiť a zdieľať" className="flex flex-col gap-3">
        <SaveTripButton gpxUrl={gpxUrl} bbox={bbox} sun={sun} destination={destination} baseHikeMin={baseHikeMin} {...trip} />
        {destination && (
          <div className="flex gap-2">
            <a href={googleMapsUrl(destination)} target="_blank" rel="noopener noreferrer" className={navButton}>
              Navigovať (Google)
            </a>
            <a href={mapyUrl(destination, start)} target="_blank" rel="noopener noreferrer" className={navButton}>
              Mapy.com
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
