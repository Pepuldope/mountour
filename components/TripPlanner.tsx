"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DayPlan, Verdict } from "@/lib/dayPlan";
import { EARLIEST_DEPARTURE_HOUR, floorTo5, longDay } from "@/lib/days";
import { formatDuration, formatTime, stopLabel } from "@/lib/format";
import { searchPlaces } from "@/lib/geocode";
import { readSharedPlan } from "@/lib/links";
import { findTown } from "@/lib/towns";
import type { SharedPlan, WalkRoute } from "@/lib/links";
import { useTripSettings } from "@/lib/tripSettings";
import { useTripPlan } from "@/lib/useTripPlan";
import { useUserLocation } from "@/lib/userLocation";
import type { BBox, LatLng } from "@/lib/types";
import { FilterChips } from "@/components/FilterChips";
import { NavHandoff } from "@/components/NavHandoff";
import { SaveTripButton } from "@/components/SaveTripButton";
import type { ShareInfo } from "@/components/ShareButton";
import { StartChip } from "@/components/StartChip";
import { SunArc } from "@/components/SunArc";
import { useTripAccess } from "@/components/TripAccess";
import { WeatherReport, useTripWeather } from "@/components/WeatherBlock";
import { TransitLegs } from "@/components/TransitBlock";
import { TravelSwitch } from "@/components/TravelSwitch";
import { GOAL_WORDS, trimProfile, withApproach } from "@/lib/tripProfile";
import type { TripProfile } from "@/lib/tripProfile";

interface Props extends ShareInfo {
  sun: LatLng | null;
  /** The trip's goal, for the weather up there. */
  goal: (LatLng & { ele: number | null; name: string }) | null;
  profile: TripProfile | null;
  gpxUrl: string | null;
  bbox: BBox | null;
  /** The trail itself, for the walking hand-off. */
  walk: WalkRoute;
  /** Top of the first card: the trail's facts and route choice. */
  intro?: ReactNode;
  /** Shown between the plan and Uložiť: parking, the map, fees... (Uložiť and navigation come last). */
  children?: ReactNode;
  /** Under Uložiť and navigation, in the last card. */
  outro?: ReactNode;
}

/** One of the page's three cards, set off from the darker page so each step reads on its own. */
const part =
  "flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--card-edge)] bg-[var(--card-bg)] p-4 shadow-[var(--shadow-card)]";


/**
 * The trip page in three cards: the plan (start, travel, day and time), the day itself
 * (sun dial, times, weather, a warning only when the start is too late), then getting there
 * (parking, map...) with Uložiť (main), share and navigation hand-offs.
 */
export function TripPlanner({ sun, goal, profile: fullProfile, gpxUrl, bbox, walk, intro, children, outro, ...trip }: Props) {
  const { start, ready, setManualStart } = useUserLocation();
  const { today, update } = useTripSettings();
  const { destination, rideTo, approachMin, trailStart, transit, noCar, parking, stop, skip, walkFrom, trailJoin, walk: onFoot } = useTripAccess();
  // The walk from the parking (by car) or the stop (by train/bus) to the trail and back belongs to the day,
  // with or without a start: the walk back to the car must fit the light too. Parked up the trail, the
  // stretch below is skipped both ways.
  const baseHikeMin = onFoot.min;
  // The walk to the trail comes first and last, so the goal time counts it too.
  const profile = useMemo(() => {
    const trail = fullProfile && skip ? trimProfile(fullProfile, skip.skip_out, skip.skip_back) : fullProfile;
    return trail && withApproach(trail, approachMin / Math.max(1, baseHikeMin));
  }, [fullProfile, skip, approachMin, baseHikeMin]);
  // One plan for the whole page: saving and sharing use the same train times the sun dial shows.
  const tripPlan = useTripPlan(sun, rideTo, baseHikeMin, transit && stop?.mode === "vlak" ? stop.location : null, noCar);
  const { plan, date, time, driveMin, roadMin, driveApprox, driveStatus, rail } = tripPlan;
  const [shared, setShared] = useState<SharedPlan | null>(null);
  const weather = useTripWeather(plan, trailStart, goal, profile?.points[0]?.ele ?? null);

  // A shared link opens the sender's day and departure (once, then it's ours to change).
  useEffect(() => {
    const fromLink = readSharedPlan(window.location.search);
    if (!fromLink || !today || fromLink.date < today) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShared(fromLink);
    update({ date: fromLink.date, time: fromLink.time });
    window.history.replaceState(null, "", window.location.pathname);
  }, [today, update]);

  // No start of our own yet: plan from the sender's town, so the times match theirs.
  const sharedTown = shared?.town ?? null;
  useEffect(() => {
    if (!ready || start || !sharedTown) return;
    const known = findTown(sharedTown);
    if (known) {
      setManualStart(known);
      return;
    }
    const ctrl = new AbortController();
    searchPlaces(sharedTown, ctrl.signal)
      .then(([place]) => {
        if (!place) return;
        setManualStart({ ...place, label: sharedTown });
      })
      .catch(() => {});
    return () => ctrl.abort();
    // Once per link: `start` is checked when the town arrives, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sharedTown, setManualStart]);
  const adopted = sharedTown !== null && start?.label === (findTown(sharedTown)?.label ?? sharedTown);

  const hasDrive = driveMin !== null;
  // The walk starts where the ride ends: the parking (or the trail start, with no parking) or the stop.
  const walkStart = walkFrom ?? destination;
  const latest = plan ? floorTo5(plan.latestStart) : null;
  const latestPassed = latest && date === today && latest < new Date();

  // Only when the chosen start oversteps: one plain warning under the day, nothing otherwise.
  const late = plan !== null && (plan.verdict === "tight" || plan.verdict === "after-sunset" || plan.verdict === "after-dusk");
  // Too long for the day's light: even leaving at first light (or before EARLIEST_DEPARTURE_HOUR) won't do.
  const tooLong =
    plan !== null &&
    latest !== null &&
    (latest.getTime() < plan.sunrise.getTime() - (driveMin ?? 0) * 60_000 || latest.getHours() < EARLIEST_DEPARTURE_HOUR);
  const startWord = hasDrive ? "Vyrazte" : transit && stop ? `Buďte na zastávke ${stopLabel(stop.name)}` : "Začnite túru";

  return (
    <div className="flex flex-col gap-5">
      {/* Three cards, so the eye takes one step at a time:
          plan the trip, see the day, then get there. */}
      <section aria-label="Plán výletu" className={part}>
        {intro}

        {shared && (
          <div className="rounded-[var(--radius-card)] bg-[var(--accent-soft)] p-4 text-sm">
            <p>
              Plán od kamaráta: <strong>{longDay(shared.date)}</strong>, odchod{" "}
              <strong className="font-data text-base">{shared.time}</strong>
              {shared.town ? `, štart ${shared.town}` : ""}.
            </p>
            <p className="text-[var(--muted)]">
              {adopted ? `Nižšie je prepočítaný zo štartu ${start?.label}. Zmeniť ho môžete hneď nižšie.` : "Nižšie je prepočítaný z vášho miesta."}
            </p>
          </div>
        )}

        {/* In the order of the day: where from, how, which day and time. */}
        <StartChip />

        <TravelSwitch roadMin={roadMin} trainMin={rail.status === "ok" ? driveMin : null} noCar={noCar} />

        <section aria-label="Deň a odchod" className="flex flex-col gap-3">
          <FilterChips variant="trip" activeDate={date} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              {hasDrive ? "Odchod" : transit && stop ? "Na zastávke" : "Začiatok túry"}
              <input
                type="time"
                step={300}
                value={time ?? ""}
                onChange={(e) => e.target.value && update({ time: e.target.value })}
                className="font-data w-32 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1.5 text-lg"
              />
            </label>
          </div>
          {driveStatus === "loading" && <p className="text-xs text-[var(--muted)]">{transit ? "Počítam cestu na zastávku..." : "Počítam cestu autom..."}</p>}
        </section>
      </section>

      {plan && (
        <section aria-label="Priebeh dňa" className={part}>
          {sun && (
            // Framed inside the card: its sky would otherwise blend into the page.
            <div className="overflow-hidden rounded-xl">
              <SunArc key={date ?? ""} plan={plan} profile={profile} sun={sun} hasDrive={hasDrive} byBus={transit} byTrain={transit && rail.status === "ok"} weather={weather.below} />
            </div>
          )}
          {plan.startsInDark && <p className="text-sm text-[var(--warn)]">Túra začína pred východom slnka, vezmite si čelovku.</p>}
          <ol className="font-data grid grid-cols-4 gap-x-2 text-[1.3rem] leading-tight font-bold sm:text-[1.6rem]">
            {/* Peter: the arrival is a big time; the departure (also set in the box above) sits small over it. */}
            <Step
              label={transit && stop ? "zastávka" : hasDrive ? (parking ? "parkovisko" : "na mieste") : "túra"}
              time={plan.hikeStart}
              above={hasDrive ? `odchod ${formatTime(plan.segments[0].start)}` : undefined}
            />
            {profile && <Step label={GOAL_WORDS[profile.goalKind].noun} time={goalTime(plan, profile)} approx />}
            <Step label={transit && stop ? "späť na zastávke" : hasDrive ? "pri aute" : "späť"} time={plan.hikeEnd} />
            {plan.segments[plan.segments.length - 1].kind === "drive-back" && <Step label="doma" time={plan.segments[plan.segments.length - 1].end} />}
          </ol>
          <WeatherReport plan={plan} weather={weather} goal={goal} wholeDay={transit} />
          {transit && <TransitLegs plan={plan} rail={rail} />}
          {transit && hasDrive && rail.status !== "ok" && (
            <p className="text-xs text-[var(--muted)]">
              Cestu autobusom odhadujeme podľa cesty autom (~{formatDuration(driveMin!)}). Presné spoje nájdete nižšie.
            </p>
          )}
          {transit && rail.status === "ok" && <p className="text-xs text-[var(--muted)]">Podľa cestovného poriadku vlakov, spoj si vyberiete nižšie.</p>}
          {driveApprox && !transit && (
            <p className="text-xs text-[var(--muted)]">Cestu autom teraz odhadujeme podľa vzdialenosti (~{formatDuration(driveMin!)}).</p>
          )}
          {!start && !transit && <p className="text-xs text-[var(--muted)]">Vyberte, odkiaľ vyrážate, a pridáme aj cestu autom.</p>}
          {(late || latestPassed) && (
            <p role="status" className="rounded-xl bg-[var(--warn-bg)] px-3.5 py-3 text-base font-semibold text-[var(--warn)]">
              {lateText(plan!.verdict, { latestPassed: !!latestPassed, tooLong, startWord, latest: formatTime(latest!) })}
            </p>
          )}
        </section>
      )}

      <section aria-label="Na mieste" className={part}>
        {children}

        <section aria-label="Uložiť a zdieľať" className="flex flex-col gap-3">
          <SaveTripButton gpxUrl={gpxUrl} bbox={bbox} sun={sun} tripPlan={tripPlan} profile={profile} {...trip} />
          <NavHandoff drive={destination} start={start} walkFrom={walkStart} walk={walk} join={trailJoin} />
        </section>

        {outro}
      </section>
    </div>
  );
}

/** One warning, in the words the trip page uses for each case. */
function lateText(
  verdict: Verdict,
  o: { latestPassed: boolean; tooLong: boolean; startWord: string; latest: string }
): string {
  if (o.tooLong) return "V tento deň je táto túra na denné svetlo pridlhá. Skúste kratšiu trasu z ponuky nižšie alebo dlhší deň.";
  if (o.latestPassed) return "Na dnes je to už neskoro, späť by ste boli po tme. Skúste zajtra ráno.";
  const leave = `${o.startWord} najneskôr o ${o.latest}.`;
  if (verdict === "tight") return `Stihnete to tesne pred západom slnka. Pre rezervu ${o.startWord.charAt(0).toLowerCase()}${o.startWord.slice(1)} najneskôr o ${o.latest}.`;
  if (verdict === "after-dusk") return `Späť by ste boli až po tme. ${leave}`;
  return `Späť by ste boli po západe slnka. ${leave}`;
}

function Step({ label, time, approx = false, above }: { label: string; time: Date; approx?: boolean; above?: string }) {
  return (
    // Bottom-aligned: a label that wraps ("späť na zastávke") keeps the times on one line.
    <li className="flex flex-col justify-end">
      {above && <span className="block font-sans text-[12px] leading-tight font-semibold whitespace-nowrap text-[var(--muted)]">{above}</span>}
      <span className="block font-sans text-[13px] leading-tight font-medium text-[var(--muted)]">{label}</span>
      <span>
        {approx ? "~" : ""}
        {formatTime(time)}
      </span>
    </li>
  );
}

/** When the walk reaches its goal (peak, lake, castle...). */
function goalTime(plan: DayPlan, profile: TripProfile): Date {
  const at = profile.points[profile.goalIndex].at;
  return new Date(plan.hikeStart.getTime() + at * (plan.hikeEnd.getTime() - plan.hikeStart.getTime()));
}
