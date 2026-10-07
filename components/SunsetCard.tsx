"use client";

import { useMemo, useState } from "react";
import { getSunTimes } from "@/lib/sun";
import { formatTime, formatDuration } from "@/lib/format";
import type { LatLng } from "@/lib/types";

interface Props {
  location: LatLng;
  durationMin: number;
}

/** Local "HH:MM" for right now, in the visitor's own timezone. */
function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function SunsetCard({ location, durationMin }: Props) {
  const [arrival, setArrival] = useState(nowHHMM());

  const result = useMemo(() => {
    const [h, m] = arrival.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;

    const now = new Date();
    const arrivalDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    const returnDate = new Date(arrivalDate.getTime() + durationMin * 60000);

    // getSunTimes wants a UTC-midnight date for "which calendar day" plus lat/lon;
    // it returns sunrise/sunset as absolute UTC instants, which compare fine
    // against our local Date objects regardless of timezone.
    const dayStart = new Date(Date.UTC(returnDate.getFullYear(), returnDate.getMonth(), returnDate.getDate()));
    const sun = getSunTimes(dayStart, location.lat, location.lon);

    if (!sun) return { returnDate, sunset: null, ok: true };

    const marginMs = sun.sunset.getTime() - returnDate.getTime();
    return { returnDate, sunset: sun.sunset, ok: marginMs >= 0, marginMin: Math.round(marginMs / 60000) };
  }, [arrival, durationMin, location]);

  const stateClass = result?.ok ? "bg-[var(--ok-bg)]" : "bg-[var(--warn-bg)]";

  return (
    <section className={`flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 ${stateClass}`}>
      <h2 className="text-sm font-semibold opacity-70">Navrat pred zapadom slnka</h2>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Cas prichodu na parkovisko
        <input
          type="time"
          value={arrival}
          onChange={(e) => setArrival(e.target.value)}
          className="w-40 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
        />
      </label>

      {result && (
        <div className="flex flex-col gap-1">
          <p className="text-base">
            Predpokladany navrat k autu: <strong>{formatTime(result.returnDate)}</strong>
            {" "}(trasa {formatDuration(durationMin)})
          </p>
          {result.sunset ? (
            <>
              <p className="text-base">
                Zapad slnka: <strong>{formatTime(result.sunset)}</strong>
              </p>
              <p className={`font-semibold ${result.ok ? "text-[var(--accent)]" : "text-[var(--warn)]"}`}>
                {result.ok
                  ? `V poriadku - stihnes sa vratit ${result.marginMin} min pred zapadom.`
                  : `Pozor - vratis sa asi ${Math.abs(result.marginMin ?? 0)} min po zapade slnka.`}
              </p>
            </>
          ) : (
            <p className="font-semibold text-[var(--warn)]">
              Zapad slnka sa nepodarilo vypocitat pre tento datum a lokalitu.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
