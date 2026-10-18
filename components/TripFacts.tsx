"use client";

import { DIFFICULTY_LABEL, formatDuration } from "@/lib/format";
import type { Difficulty } from "@/lib/types";
import { useTripSettings } from "@/lib/tripSettings";
import { formatKm, walkMinutes } from "@/lib/walkFacts";
import { useTripAccess } from "@/components/TripAccess";
import { UiIcon } from "@/components/UiIcon";

interface Props {
  /** A loop: the length is round, not there and back. */
  loop: boolean;
  difficulty: Difficulty;
  familyFriendly: boolean;
}

/** Length, climb and walking time of the walk the day counts: from the parking or stop, at the group's pace. */
export function TripFacts({ loop, difficulty, familyFriendly }: Props) {
  const { walk, transit } = useTripAccess();
  const { withKids } = useTripSettings();
  return (
    <p className="font-data flex flex-wrap items-center gap-x-3.5 text-[17px]">
      <span className="inline-flex items-baseline gap-1">
        {formatKm(walk.m)}
        <small className={small}>{loop ? "okruh" : "tam a späť"}</small>
      </span>
      <span className="inline-flex items-center gap-1">
        <UiIcon name="up" size={16} />
        {walk.ascentM} m
      </span>
      <span className="inline-flex items-center gap-1">
        <UiIcon name="clock" size={16} />
        {formatDuration(walkMinutes(walk, withKids))}
        {withKids && <small className={small}>s deťmi</small>}
      </span>
      <span className="font-sans text-[13px] font-medium text-[var(--muted)]">{DIFFICULTY_LABEL[difficulty].toLowerCase()}</span>
      {familyFriendly && <span className="font-sans text-[13px] font-semibold text-[var(--ok)]">vhodné pre deti</span>}
      {(walk.skipped || walk.approachMin > 0) && (
        <span className="w-full font-sans text-[13px] text-[var(--muted)]">{factsNote(walk.skipped, transit)}</span>
      )}
    </p>
  );
}

/** Words next to a number: what it counts. */
const small = "font-sans text-[12px] font-semibold text-[var(--muted)]";

/** Why the walk differs from the route from its official start, in one line. */
function factsNote(skipped: boolean, transit: boolean): string {
  if (skipped) return transit ? "Zastávka je priamo pri trase, kúsok pod ňou nejdete." : "Parkovisko je priamo pri trase, kúsok pod ním nejdete.";
  return `Aj s chôdzou ${transit ? "od zastávky" : "od parkoviska"} k trase a späť.`;
}
