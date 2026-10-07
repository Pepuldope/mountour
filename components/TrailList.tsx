"use client";

import Link from "next/link";
import type { TrailDetail } from "@/lib/types";
import {
  DIFFICULTY_LABEL,
  formatDistance,
  formatDuration,
  formatFromUser,
} from "@/lib/format";

export interface TrailListItem {
  detail: TrailDetail;
  /** Metres to the primary trailhead; null when the user's location is unknown. */
  distanceFromUserM: number | null;
}

interface Props {
  items: TrailListItem[];
  activeSlug: string | null;
  onActiveChange: (slug: string | null) => void;
  registerItem: (slug: string, el: HTMLElement | null) => void;
}

export function TrailList({ items, activeSlug, onActiveChange, registerItem }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold opacity-70">
        {items.length === 0 ? "Žiadna trasa nevyhovuje" : `Vyhovujúce trasy (${items.length})`}
      </h2>

      {items.map(({ detail: { trail }, distanceFromUserM }) => (
        <Link
          key={trail.id}
          ref={(el) => registerItem(trail.slug, el)}
          href={`/trasa/${trail.slug}`}
          onMouseEnter={() => onActiveChange(trail.slug)}
          onMouseLeave={() => onActiveChange(null)}
          onFocus={() => onActiveChange(trail.slug)}
          onBlur={() => onActiveChange(null)}
          className={`flex flex-col gap-1 rounded-xl border bg-[var(--card-bg)] p-4 transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
            activeSlug === trail.slug ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"
          }`}
        >
          <span className="text-lg font-semibold">{trail.name}</span>
          <span className="text-sm opacity-70">
            {formatDistance(trail.distance_m)} - {trail.ascent_m} m prevýšenia -{" "}
            {DIFFICULTY_LABEL[trail.difficulty]} - {formatDuration(trail.duration_min)}
          </span>
          {distanceFromUserM != null && (
            <span className="text-sm font-medium">{formatFromUser(distanceFromUserM)} od teba</span>
          )}
          {trail.family_friendly && (
            <span className="text-xs font-medium text-[var(--accent)]">Vhodné pre deti</span>
          )}
        </Link>
      ))}
    </section>
  );
}
