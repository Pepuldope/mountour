"use client";

import Link from "next/link";
import { EARLIEST_DEPARTURE_HOUR } from "@/lib/days";
import type { DayFit } from "@/lib/days";
import { DIFFICULTY_LABEL, formatDuration, formatFromUser, formatTime } from "@/lib/format";
import { MARKING_COLOR, MARKING_LABEL } from "@/lib/mapLayers";
import type { TrailDetail } from "@/lib/types";

export interface TripCardItem {
  detail: TrailDetail;
  /** Walking time for this group (kids pace applied). */
  hikeMin: number;
  /** One-way drive in minutes; null when unknown. */
  driveMin: number | null;
  /** The drive is a straight-line estimate (routing unavailable). */
  driveApprox: boolean;
  driveLoading: boolean;
  /** Straight-line metres to the trailhead; null without a start. */
  distanceM: number | null;
  /** Only when a day is picked. */
  fit: DayFit | null;
  /** A closure (e.g. TANAP winter) covers the picked day. */
  closed: boolean;
}

interface Props {
  item: TripCardItem;
  /** "dnes", "v sobotu": for the "doesn't fit" line. */
  dayWord: string | null;
  active: boolean;
  onActive: (slug: string) => void;
  registerItem: (slug: string, el: HTMLElement | null) => void;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One trip, one decision line: travel and walking time, then "Vyrazte najneskôr". */
export function TripCard({ item, dayWord, active, onActive, registerItem }: Props) {
  const { detail, hikeMin, driveMin, driveApprox, driveLoading, distanceM, fit, closed } = item;
  const { trail } = detail;
  const total = driveMin !== null ? hikeMin + 2 * driveMin : null;
  const approx = driveApprox ? "~" : "";

  return (
    <Link
      ref={(el) => registerItem(trail.slug, el)}
      href={`/trasa/${trail.slug}`}
      onMouseEnter={() => onActive(trail.slug)}
      onFocus={() => onActive(trail.slug)}
      className={`flex flex-col gap-1.5 rounded-[var(--radius-card)] border bg-[var(--card-bg)] p-4 transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
        active ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"
      } ${closed || (fit && fit.status !== "fits") ? "opacity-75" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-lg leading-tight font-semibold">
          {trail.marking && (
            <span
              className="trail-mark"
              style={{ ["--mark" as string]: MARKING_COLOR[trail.marking] }}
              title={MARKING_LABEL[trail.marking]}
            />
          )}
          {trail.name}
        </span>
        <span className="shrink-0 pt-0.5 text-sm text-[var(--muted)]">{DIFFICULTY_LABEL[trail.difficulty]}</span>
      </div>

      <p className="font-data flex flex-wrap gap-x-3 text-[15px] text-[var(--muted)]">
        {driveMin !== null ? (
          <span>
            autom {approx}
            {formatDuration(driveMin)}
          </span>
        ) : driveLoading ? (
          <span>autom …</span>
        ) : (
          distanceM !== null && <span>{formatFromUser(distanceM)} vzdušnou čiarou</span>
        )}
        <span>chôdza {formatDuration(hikeMin)}</span>
        {!fit && total !== null && (
          <span className="text-[var(--foreground)]">
            spolu {approx}
            {formatDuration(total)}
          </span>
        )}
      </p>

      {closed && (
        <p className="text-sm text-[var(--warn)]">{capitalize(dayWord ?? "v tento deň")} je chodník uzavretý (sezónna uzávera).</p>
      )}
      {!closed && fit && fit.status === "fits" && (
        <p className="flex items-baseline gap-2">
          <span className="text-sm">{driveMin !== null ? "Vyrazte najneskôr" : "Začnite túru najneskôr"}</span>
          <span className="font-data text-2xl leading-none text-[var(--time)]">{formatTime(fit.latest)}</span>
        </p>
      )}
      {!closed && fit && fit.status === "too-late" && (
        <p className="text-sm text-[var(--warn)]">
          {dayWord === "dnes" ? "Dnes" : "Vtedy"} už nestihnete za svetla. Skúste zajtra ráno.
        </p>
      )}
      {!closed && fit && fit.status === "too-early" && (
        <p className="text-sm text-[var(--warn)]">
          {capitalize(dayWord ?? "v tento deň")} by ste museli vyraziť pred {EARLIEST_DEPARTURE_HOUR}:00.
        </p>
      )}
      {!closed && fit && fit.status === "too-long" && (
        <p className="text-sm text-[var(--warn)]">{capitalize(dayWord ?? "v tento deň")} je na to málo svetla.</p>
      )}

      {trail.family_friendly && <span className="text-xs font-semibold text-[var(--ok)]">Vhodné pre deti</span>}
    </Link>
  );
}
