"use client";

import type { TransitStop } from "@/lib/types";
import { TRANSIT_LABEL } from "@/lib/format";
import { cpSkUrl, startTown } from "@/lib/links";
import { useTripDay } from "@/lib/tripSettings";
import { useUserLocation } from "@/lib/userLocation";

interface Props {
  stops: TransitStop[];
}

/**
 * "Bez auta": the nearest stop and one tap to cp.sk, prefilled with the start
 * town, the stop, the day and the departure (PD3). Real timetables come later.
 */
export function TransitBlock({ stops }: Props) {
  const { start, fix } = useUserLocation();
  const { date, time } = useTripDay();
  const nearest = [...stops].sort((a, b) => a.distance_m - b.distance_m)[0] ?? null;
  const from = startTown(start, fix?.town);

  return (
    <section className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <h2 className="text-base font-bold">Bez auta</h2>
      {nearest ? (
        <>
          <p className="text-sm">
            {TRANSIT_LABEL[nearest.mode]}: zastávka <strong>{nearest.name}</strong>,{" "}
            <span className="font-data">{nearest.distance_m} m</span> od začiatku trasy.
          </p>
          <a
            href={cpSkUrl(nearest.name, from, date, time)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-sm font-semibold text-[var(--accent)] underline"
          >
            Spoje na cp.sk ↗
          </a>
        </>
      ) : (
        <>
          <p className="text-sm">Pri začiatku trasy sme nenašli zastávku.</p>
          <a
            href="https://cp.sk/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-sm font-semibold text-[var(--accent)] underline"
          >
            Vyhľadať spoj na cp.sk ↗
          </a>
        </>
      )}
    </section>
  );
}
