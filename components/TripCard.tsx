"use client";

import Link from "next/link";
import { EARLIEST_DEPARTURE_HOUR } from "@/lib/days";
import type { DayFit } from "@/lib/days";
import { DIFFICULTY_LABEL, GOAL_LABEL, formatDurationShort, formatFromUser, formatTime, stopLabel } from "@/lib/format";
import { kindSvg } from "@/lib/kindIcons";
import { GOAL_COLOUR } from "@/lib/palette";
import type { TrailDetail, TransitStop } from "@/lib/types";
import { UiIcon } from "@/components/UiIcon";

export interface TripCardItem {
  detail: TrailDetail;
  /** Walking time for this group (kids pace applied). */
  hikeMin: number;
  /** One-way drive used for the plan; null by train/bus or when unknown. */
  driveMin: number | null;
  /** One-way drive for display, also shown when travelling by train/bus. */
  carMin: number | null;
  /** The drive is a straight-line estimate (routing unavailable). */
  driveApprox: boolean;
  driveLoading: boolean;
  /** Straight-line metres to the trailhead; null without a start. */
  distanceM: number | null;
  /** Only when a day is picked. */
  fit: DayFit | null;
  /** A closure (e.g. TANAP winter) covers the picked day. */
  closed: boolean;
  /** By train/bus: the stop the walk starts from. */
  stop: TransitStop | null;
  /** The nearest stop, whatever the travel choice. */
  nearStop: TransitStop | null;
  /** By train/bus, and no stop near the start. */
  noStop: boolean;
}

interface Props {
  item: TripCardItem;
  /** "dnes", "v sobotu": for the "doesn't fit" line. */
  dayWord: string | null;
  /** Travelling by train/bus: its line is the one in focus. */
  transit: boolean;
  active: boolean;
  /** Picked on the map (computer): a bigger card with a few more facts, closed with ✕. */
  onClose?: () => void;
  onActive: (slug: string) => void;
  registerItem: (slug: string, el: HTMLElement | null) => void;
}

/** Leaving within this long counts as "tesne" (amber). */
const TIGHT_MIN = 90;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Pill = { tone: "ok" | "tight" | "no"; text: string; time?: string };

function pillFor(item: TripCardItem, dayWord: string | null): Pill | null {
  const { fit, closed, noStop, driveMin, stop } = item;
  const day = capitalize(dayWord ?? "v tento deň");
  if (noStop) return { tone: "no", text: "Pri štarte nie je zastávka" };
  if (closed) return { tone: "no", text: `${day} je chodník uzavretý` };
  if (!fit) return null;
  if (fit.status === "too-late") return { tone: "no", text: `${dayWord === "dnes" ? "Dnes" : "Vtedy"} už nestihnete · skúste zajtra` };
  if (fit.status === "too-early") return { tone: "no", text: `${day} by ste museli vyraziť pred ${EARLIEST_DEPARTURE_HOUR}:00` };
  if (fit.status === "too-long") return { tone: "no", text: `${day} je na to málo svetla` };
  const verb = driveMin !== null ? "vyrazte do" : stop ? "na zastávke do" : "začnite do";
  const tight = dayWord === "dnes" && fit.latest.getTime() - Date.now() < TIGHT_MIN * 60000;
  return tight
    ? { tone: "tight", text: `Tesne · ${verb}`, time: formatTime(fit.latest) }
    : { tone: "ok", text: capitalize(verb), time: formatTime(fit.latest) };
}

const PILL_CLASS = {
  ok: "bg-[var(--ok-bg)] text-[var(--ok)]",
  tight: "bg-[var(--warn-bg)] text-[var(--warn)]",
  no: "bg-[var(--neutral-bg)] text-[var(--muted)]",
};

/** One trip: what it is, how long to get there and walk, and when to leave. */
export function TripCard({ item, dayWord, transit, active, onClose, onActive, registerItem }: Props) {
  const { detail, hikeMin, carMin, driveMin, driveApprox, driveLoading, distanceM, nearStop } = item;
  const { trail } = detail;
  const goal = trail.goal ?? "ine";
  const colour = GOAL_COLOUR[goal];
  const approx = driveApprox || transit ? "~" : "";
  const pill = pillFor(item, dayWord);
  const km = (trail.distance_m / 1000).toFixed(1).replace(".", ",");
  const total = driveMin !== null && !item.fit ? hikeMin + 2 * driveMin : null;
  const big = onClose !== undefined;
  const th = detail.trailheads.find((t) => t.is_primary) ?? detail.trailheads[0];
  const parking = detail.parkingLots[0];
  const leg = (on: boolean) => `inline-flex items-center gap-1 ${on ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`;

  return (
    <Link
      ref={(el) => registerItem(trail.slug, el)}
      href={`/trasa/${trail.slug}`}
      onMouseEnter={() => onActive(trail.slug)}
      onFocus={() => onActive(trail.slug)}
      className={`grid grid-cols-[54px_1fr] gap-3 rounded-[var(--radius-card)] border bg-[var(--card-bg)] p-3 transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
        big ? "border-2 border-[var(--accent)] shadow-[0_10px_28px_rgba(20,35,59,0.22)]" : active ? "trip-card-active border-[var(--accent)]" : "border-[var(--border)]"
      } ${pill?.tone === "no" && !big ? "opacity-70" : ""}`}
    >
      <span
        aria-hidden
        className="grid h-[54px] w-[54px] place-items-center rounded-[14px] text-white"
        style={{ background: colour }}
        // Constant markup from lib/kindIcons.ts, no user data.
        dangerouslySetInnerHTML={{ __html: kindSvg(goal, 28) }}
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`leading-tight font-bold ${big ? "text-xl" : "text-base"}`}>{trail.name}</span>
          {big ? (
            <button
              type="button"
              aria-label="Zavrieť"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--segment-bg)] text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <UiIcon name="close" size={12} />
            </button>
          ) : (
            <span className="shrink-0 text-xs font-semibold text-[var(--muted)]">{DIFFICULTY_LABEL[trail.difficulty].toLowerCase()}</span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-[var(--muted)]">
          <span className="kind-ink font-bold" style={{ "--kind": colour } as React.CSSProperties}>
            {GOAL_LABEL[goal]}
          </span>
          {trail.region_name && <span>· {trail.region_name}</span>}
          <span>· {km} km</span>
          {trail.family_friendly && <span className="on-card-ok font-semibold text-[var(--ok)]">· pre deti</span>}
        </span>
        <span className="font-data flex flex-wrap items-center gap-x-3 text-[15px]">
          <span className={leg(!transit)}>
            <UiIcon name="car" size={15} />
            {carMin !== null ? `${driveApprox ? "~" : ""}${formatDurationShort(carMin)}` : driveLoading ? "…" : distanceM !== null ? formatFromUser(distanceM) : "–"}
          </span>
          <span className={leg(transit)} title={nearStop ? `Zastávka ${stopLabel(nearStop.name)}, ${formatFromUser(nearStop.distance_m)} od štartu` : "Bez zastávky pri štarte"}>
            <UiIcon name="bus" size={15} />
            {transit && driveMin !== null ? `~${formatDurationShort(driveMin)}` : nearStop ? formatFromUser(nearStop.distance_m) : "–"}
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--foreground)]">
            <UiIcon name="boot" size={15} />
            {formatDurationShort(hikeMin)}
          </span>
          {total !== null && (
            <span className="text-[var(--muted)]">
              spolu {approx}
              {formatDurationShort(total)}
            </span>
          )}
        </span>
        {big && (
          <>
            <span className="mt-1.5 grid grid-cols-4 gap-1.5 border-y border-[var(--border)] py-2.5">
              {[
                ["chôdza", formatDurationShort(hikeMin)],
                ["dĺžka", `${km} km`],
                ["stúpanie", `${trail.ascent_m} m`],
                ["náročnosť", DIFFICULTY_LABEL[trail.difficulty].toLowerCase()],
              ].map(([label, value]) => (
                <span key={label} className="flex flex-col">
                  <span className="text-[11.5px] text-[var(--muted)]">{label}</span>
                  <span className={label === "náročnosť" ? "text-[15px] font-bold" : "font-data text-[17px] leading-tight font-bold"}>{value}</span>
                </span>
              ))}
            </span>
            <span className="flex flex-col gap-0.5 text-[13.5px]">
              {th && <span>Štart: {th.name}</span>}
              {parking && <span>Parkovanie {parking.walk_m < 150 ? "pri štarte" : `${formatFromUser(parking.walk_m)} od štartu`}</span>}
              {nearStop && <span>Zastávka {stopLabel(nearStop.name)}, {formatFromUser(nearStop.distance_m)} pešo</span>}
            </span>
          </>
        )}
        {pill && (
          <span className={`mt-0.5 inline-flex items-baseline gap-1.5 self-start rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${PILL_CLASS[pill.tone]}`}>
            {pill.text}
            {pill.time && <span className="font-data text-[17px] leading-none font-bold">{pill.time}</span>}
          </span>
        )}
        {big && (
          <span className="mt-1.5 flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] font-bold text-[var(--accent-contrast)]">Otvoriť výlet</span>
        )}
      </span>
    </Link>
  );
}
