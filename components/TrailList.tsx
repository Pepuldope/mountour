"use client";

import Link from "next/link";
import type { DayPlan } from "@/lib/dayPlan";
import type { TrailDetail } from "@/lib/types";
import {
  DIFFICULTY_LABEL,
  VERDICT_SHORT,
  formatDistance,
  formatDuration,
  formatFromUser,
  formatTime,
} from "@/lib/format";
import { TimelineBar } from "@/components/TimelineBar";

export interface TrailListItem {
  detail: TrailDetail;
  /** Straight-line metres to the primary trailhead; null when the start is unknown. */
  distanceFromUserM: number | null;
  /** One-way drive in minutes; null when unknown. */
  driveMin: number | null;
  /** The day for this trail with the current inputs; null before hydration. */
  plan: DayPlan | null;
}

interface Props {
  items: TrailListItem[];
  /** How many trails exist before filtering. */
  total: number;
  activeSlug: string | null;
  onActiveChange: (slug: string) => void;
  registerItem: (slug: string, el: HTMLElement | null) => void;
}

export function TrailList({ items, total, activeSlug, onActiveChange, registerItem }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold opacity-70">
        {items.length === 0 ? "Žiadna trasa nevyhovuje" : `Vyhovujúce trasy (${items.length} z ${total})`}
      </h2>
      {items.length === 0 && (
        <p className="text-sm opacity-70">Skús pridať viac času alebo vyraziť bližšie k horám.</p>
      )}

      {items.map(({ detail: { trail }, distanceFromUserM, driveMin, plan }) => {
        const good = plan?.verdict === "ok";
        return (
          <Link
            key={trail.id}
            ref={(el) => registerItem(trail.slug, el)}
            href={`/trasa/${trail.slug}`}
            onMouseEnter={() => onActiveChange(trail.slug)}
            onFocus={() => onActiveChange(trail.slug)}
            className={`flex flex-col gap-2 rounded-xl border bg-[var(--card-bg)] p-4 transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
              activeSlug === trail.slug ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"
            }`}
          >
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold">{trail.name}</span>
              <span className="text-sm opacity-70">
                {formatDistance(trail.distance_m)} - {trail.ascent_m} m prevýšenia -{" "}
                {DIFFICULTY_LABEL[trail.difficulty]} - {formatDuration(trail.duration_min)}
              </span>
              {trail.family_friendly && (
                <span className="text-xs font-medium text-[var(--accent)]">Vhodné pre deti</span>
              )}
            </div>

            {plan && (
              <>
                <TimelineBar plan={plan} good={good} hasDrive={driveMin !== null} compact />
                <span className="flex flex-wrap gap-x-2 text-sm">
                  {driveMin !== null ? (
                    <span>autom {formatDuration(driveMin)}</span>
                  ) : (
                    distanceFromUserM != null && <span>{formatFromUser(distanceFromUserM)} vzdušnou čiarou</span>
                  )}
                  <span className="opacity-70">koniec túry {formatTime(plan.hikeEnd)}</span>
                  <span className={`font-medium ${good ? "text-[var(--accent)]" : "text-[var(--warn)]"}`}>
                    {VERDICT_SHORT[plan.verdict]}
                  </span>
                </span>
              </>
            )}
          </Link>
        );
      })}
    </section>
  );
}
