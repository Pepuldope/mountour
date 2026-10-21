"use client";

import { useRouter } from "next/navigation";
import { planDay } from "@/lib/dayPlan";
import { isoDate } from "@/lib/days";
import { VERDICT_SHORT, formatDateSk, formatDuration, formatTime } from "@/lib/format";
import { useSavedTrips } from "@/lib/savedTrips";
import type { SavedTrip } from "@/lib/savedTrips";
import { useTripSettings } from "@/lib/tripSettings";
import { useUserLocation } from "@/lib/userLocation";
import { SunArc } from "@/components/SunArc";

function todayIso(): string {
  return isoDate(new Date());
}

/** Saved trips on this device. Renders from the saved snapshots alone, so it works offline. */
export function SavedTripsList() {
  const { trips, remove } = useSavedTrips();
  const { update } = useTripSettings();
  const { setManualStart } = useUserLocation();
  const router = useRouter();
  const today = todayIso();

  function open(trip: SavedTrip) {
    update({ date: trip.date, time: trip.time, ...(trip.travel ? { travel: trip.travel } : {}), ...(trip.withKids !== undefined ? { withKids: trip.withKids } : {}) });
    if (trip.start) setManualStart(trip.start);
    const href = `/trasa/${trip.slug}`;
    // Offline, a full page load lets the service worker serve the saved copy
    // (client-side navigation would need a network fetch).
    if (navigator.onLine) router.push(href);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    else window.location.assign(href);
  }

  if (trips.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm opacity-80">
        Zatiaľ tu nemáte žiadny výlet. Na stránke trasy ťuknite na {"„Uložiť výlet“"}, uloží sa aj s
        mapou, aby fungoval bez signálu.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {trips.map((trip) => {
        const transit = trip.transit ?? false;
        const byTrain = transit && !!trip.fixed;
        const plan = planDay({
          date: trip.date,
          start: trip.time,
          driveMin: trip.driveMin,
          hikeMin: trip.hikeMin,
          location: trip.sun,
          travelMode: transit ? "transit" : "auto",
          approx: transit && !trip.fixed,
          fixed: trip.fixed ?? null,
        });
        const past = trip.date < today;
        const good = plan?.verdict === "ok" || plan?.verdict === "close";
        return (
          <li
            key={trip.slug}
            className={`flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)] p-4 ${past ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 className="text-lg font-semibold">{trip.name}</h2>
              <span className="text-sm tabular-nums">
                {formatDateSk(trip.date)} o {trip.time}
                {past && " · už prebehol"}
              </span>
            </div>
            <p className="text-sm opacity-70">
              {trip.start ? `Štart: ${trip.start.label}` : "Bez miesta štartu"}
              {trip.driveMin !== null && ` · ${byTrain ? "vlakom" : transit ? "autobusom" : "autom"} ${formatDuration(trip.driveMin)}`}
              {" · "}
              {trip.offline === "ok" ? "funguje bez signálu" : "len so signálom"}
            </p>
            {plan && (
              <>
                <div className="-mx-4 overflow-hidden border-y border-[var(--border)]">
                  <SunArc plan={plan} profile={trip.profile ?? null} sun={trip.sun} hasDrive={trip.driveMin !== null} byBus={transit} byTrain={byTrain} />
                </div>
                <p className="text-sm">
                  <span className="opacity-70">koniec túry {formatTime(plan.hikeEnd)} </span>
                  <span className={`font-medium ${good ? "text-[var(--ok)]" : "text-[var(--warn)]"}`}>
                    {VERDICT_SHORT[plan.verdict]}
                  </span>
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => open(trip)}
                className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--accent-contrast)]"
              >
                Otvoriť
              </button>
              <button
                type="button"
                onClick={() => remove(trip.slug)}
                className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--accent)]"
              >
                Odstrániť
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
