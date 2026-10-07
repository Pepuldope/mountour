"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TrailDetail } from "@/lib/types";
import { filterTrails } from "@/lib/data";
import { DIFFICULTY_LABEL, formatDistance, formatDuration } from "@/lib/format";

interface Props {
  trails: TrailDetail[];
}

export function TrailPicker({ trails }: Props) {
  const [hours, setHours] = useState(4);
  const [startFrom, setStartFrom] = useState("");
  const [withKids, setWithKids] = useState(false);
  const [locating, setLocating] = useState(false);

  const matches = useMemo(
    () => filterTrails(trails, { maxHours: hours, withKids }),
    [trails, hours, withKids]
  );

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStartFrom(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kolko casu mam (hodiny)
          <input
            type="number"
            min={1}
            max={12}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Odkiaľ vyrážam
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="napr. Bratislava"
              value={startFrom}
              onChange={(e) => setStartFrom(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
            />
            <button
              type="button"
              onClick={useMyLocation}
              className="whitespace-nowrap rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              {locating ? "Hľadám..." : "Moja poloha"}
            </button>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2 text-sm font-medium">
          Idem s detmi
          <input
            type="checkbox"
            checked={withKids}
            onChange={(e) => setWithKids(e.target.checked)}
            className="h-5 w-5 accent-[var(--accent)]"
          />
        </label>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold opacity-70">
          {matches.length === 0
            ? "Žiadna trasa nevyhovuje"
            : `Vyhovujúce trasy (${matches.length})`}
        </h2>

        {matches.map(({ trail }) => (
          <Link
            key={trail.id}
            href={`/trasa/${trail.slug}`}
            className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 transition-colors hover:border-[var(--accent)]"
          >
            <span className="text-lg font-semibold">{trail.name}</span>
            <span className="text-sm opacity-70">
              {formatDistance(trail.distance_m)} - {trail.ascent_m} m prevysenia -{" "}
              {DIFFICULTY_LABEL[trail.difficulty]} - {formatDuration(trail.duration_min)}
            </span>
            {trail.family_friendly && (
              <span className="text-xs font-medium text-[var(--accent)]">Vhodné pre deti</span>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}
