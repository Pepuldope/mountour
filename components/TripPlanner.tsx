"use client";

import { useEffect, useState } from "react";
import { SAFE_MARGIN_MIN } from "@/lib/dayPlan";
import type { DayPlan } from "@/lib/dayPlan";
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
import { SunArc } from "@/components/SunArc";
import { GOAL_WORDS } from "@/lib/tripProfile";
import type { TripProfile } from "@/lib/tripProfile";

interface Props extends ShareInfo {
  sun: LatLng | null;
  destination: LatLng | null;
  baseHikeMin: number;
  profile: TripProfile | null;
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
export function TripPlanner({ sun, destination, baseHikeMin, profile, gpxUrl, bbox, ...trip }: Props) {
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
          className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)]"
        >
          <div className="flex flex-col gap-1 px-4 pt-3.5 pb-2">
            <p className="text-sm text-[var(--muted)]">
              {startName && hasDrive ? `Štart ${startName} · ` : ""}
              {capitalize(`${date ? `${dayInSentence(date, new Date())} ` : ""}${hasDrive ? "vyrazte" : "začnite túru"} najneskôr`)}
            </p>
            <p className="font-data text-5xl leading-none text-[var(--time)]">{formatTime(latest!)}</p>
            <p className="text-sm">
              a budete späť {SAFE_MARGIN_MIN} min pred západom slnka ({formatTime(plan.sunset)})
            </p>
            {latestPassed && (
              <p className="pt-1 text-sm font-semibold text-[var(--time)]">Na dnes je to už neskoro. Skúste zajtra ráno.</p>
            )}
            {driveApprox && (
              <p className="pt-1 text-xs text-[var(--muted)]">Cestu autom teraz odhadujeme podľa vzdialenosti (~{formatDuration(driveMin!)}).</p>
            )}
            {!start && <p className="pt-1 text-xs text-[var(--muted)]">Vyberte, odkiaľ vyrážate, a pridáme aj cestu autom.</p>}
          </div>
          {sun && <SunArc key={date ?? ""} plan={plan} profile={profile} sun={sun} hasDrive={hasDrive} />}
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
          <p
            role="status"
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${good ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[var(--warn-bg)] text-[var(--warn)]"}`}
          >
            {verdictText(plan)}
          </p>
          {plan.startsInDark && <p className="text-sm text-[var(--warn)]">Túra začína pred východom slnka, vezmite si čelovku.</p>}
          <ol className="font-data grid grid-cols-4 gap-x-3 text-[16px]">
            {hasDrive ? (
              <Step label="odchod" time={plan.segments[0].start} />
            ) : (
              <Step label="túra" time={plan.hikeStart} />
            )}
            {profile && <Step label={GOAL_WORDS[profile.goalKind].noun} time={goalTime(plan, profile)} approx />}
            <Step label="späť" time={plan.hikeEnd} />
            {hasDrive && <Step label="doma" time={plan.segments[plan.segments.length - 1].end} />}
          </ol>
        </section>
      )}

      <section aria-label="Uložiť a zdieľať" className="flex flex-col gap-3">
        <SaveTripButton gpxUrl={gpxUrl} bbox={bbox} sun={sun} destination={destination} baseHikeMin={baseHikeMin} {...trip} />
        {destination && (
          <div className="flex gap-2">
            <a href={googleMapsUrl(destination)} data-umami-event="nav_open" data-umami-event-app="google" target="_blank" rel="noopener noreferrer" className={navButton}>
              Navigovať (Google)
            </a>
            <a href={mapyUrl(destination, start)} data-umami-event="nav_open" data-umami-event-app="mapy" target="_blank" rel="noopener noreferrer" className={navButton}>
              Mapy.com
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

function Step({ label, time, approx = false }: { label: string; time: Date; approx?: boolean }) {
  return (
    <li>
      <span className="block font-sans text-[11px] font-medium text-[var(--muted)]">{label}</span>
      {approx ? "~" : ""}
      {formatTime(time)}
    </li>
  );
}

/** When the walk reaches its goal (peak, lake, castle...). */
function goalTime(plan: DayPlan, profile: TripProfile): Date {
  const at = profile.points[profile.goalIndex].at;
  return new Date(plan.hikeStart.getTime() + at * (plan.hikeEnd.getTime() - plan.hikeStart.getTime()));
}
