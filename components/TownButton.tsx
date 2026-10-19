"use client";

import Link from "next/link";
import { haversineM } from "@/lib/geo";
import { townGenitive } from "@/lib/townNames";
import { nearestTown } from "@/lib/trips";
import type { LatLng } from "@/lib/types";

/** The start counts as the town when it is this close to the centre. */
const NEAR_TOWN_M = 10_000;

/** One big way into the town page, only when the start is a well-known town with good trips around it. */
export function TownButton({ start, knownTowns }: { start: LatLng | null; knownTowns: string[] }) {
  const town = start ? nearestTown(start) : null;
  if (!start || !town || !knownTowns.includes(town.id) || haversineM(start, town.location) > NEAR_TOWN_M) return null;
  return (
    <Link
      href={`/vylety-z/${town.id}`}
      className="-mx-1 flex items-center gap-3.5 rounded-[var(--radius-card)] border border-[var(--card-edge)] bg-[var(--card-bg)] px-4 py-3.5 text-[var(--foreground)] no-underline shadow-[var(--shadow-card)]"
    >
      <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 19.5 9.5 7l3.4 5.6 2.1-3.1 6.5 10z" fill="currentColor" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg leading-tight font-extrabold">Výlety okolo {townGenitive(town.id, town.name)}</span>
        <span className="text-sm text-[var(--muted)]">Hrady, vrcholy a jaskyne do 1,5 h autom</span>
      </span>
      <span className="text-[26px] font-bold text-[var(--accent)]" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
