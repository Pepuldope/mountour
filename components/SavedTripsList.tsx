"use client";

import { useRouter } from "next/navigation";
import { planDay } from "@/lib/dayPlan";
import { VERDICT_SHORT, formatDateSk, formatDuration, formatTime } from "@/lib/format";
import { useSavedTrips } from "@/lib/savedTrips";
import type { SavedTrip } from "@/lib/savedTrips";
import { useTripSettings } from "@/lib/tripSettings";
import { useUserLocation } from "@/lib/userLocation";
import { TimelineBar } from "@/components/TimelineBar";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Saved trips on this device. Renders from the saved snapshots alone, so it works offline. */
export function SavedTripsList() {
  const { trips, remove } = useSavedTrips();
  const { update } = useTripSettings();
  const { setManualStart } = useUserLocation();
  const router = useRouter();
  const today = todayIso();

  function open(trip: SavedTrip) {
    update({ date: trip.date, time: trip.time });
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
        Zatiaľ nemáš uložený žiadny výlet. Na stránke trasy klikni na {"„Uložiť výlet“"} - uloží sa aj
        s mapou, aby fungoval bez signálu.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {trips.map((trip) => {
        const plan = planDay({
          date: trip.date,
          start: trip.time,
          driveMin: trip.driveMin,
          hikeMin: trip.hikeMin,
          location: trip.sun,
        });
        const past = trip.date < today;
        const good = plan?.verdict === "ok";
        return (
          <li
            key={trip.slug}
            className={`flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 ${past ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 className="text-lg font-semibold">{trip.name}</h2>
              <span className="text-sm tabular-nums">
                {formatDateSk(trip.date)} o {trip.time}
                {past && " - už prebehol"}
              </span>
            </div>
            <p className="text-sm opacity-70">
              {trip.start ? `Štart: ${trip.start.label}` : "Bez miesta štartu"}
              {trip.driveMin !== null && ` - autom ${formatDuration(trip.driveMin)}`}
              {" - "}
              {trip.offline === "ok" ? "dostupné offline" : "len online"}
            </p>
            {plan && (
              <>
                <TimelineBar plan={plan} good={good} hasDrive={trip.driveMin !== null} compact />
                <p className="text-sm">
                  <span className="opacity-70">koniec túry {formatTime(plan.hikeEnd)} </span>
                  <span className={`font-medium ${good ? "text-[var(--accent)]" : "text-[var(--warn)]"}`}>
                    {VERDICT_SHORT[plan.verdict]}
                  </span>
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => open(trip)}
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)]"
              >
                Otvoriť
              </button>
              <button
                type="button"
                onClick={() => remove(trip.slug)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
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
