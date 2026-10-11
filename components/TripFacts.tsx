"use client";

import { DIFFICULTY_LABEL, formatDuration } from "@/lib/format";
import { joinedMinutes } from "@/lib/trailJoin";
import type { Difficulty } from "@/lib/types";
import { useTripAccess } from "@/components/TripAccess";
import { UiIcon } from "@/components/UiIcon";

interface Props {
  distanceM: number;
  ascentM: number;
  durationMin: number;
  difficulty: Difficulty;
  familyFriendly: boolean;
}

/** Length, climb and walking time; parked up the trail, without the stretch you skip. */
export function TripFacts({ distanceM, ascentM, durationMin, difficulty, familyFriendly }: Props) {
  const { skip, transit } = useTripAccess();
  const km = ((distanceM - (skip?.skip_m ?? 0)) / 1000).toFixed(1).replace(".", ",");
  return (
    <p className="font-data flex flex-wrap items-center gap-x-3.5 text-[17px]">
      <span>{km} km</span>
      <span className="inline-flex items-center gap-1">
        <UiIcon name="up" size={16} />
        {Math.max(0, ascentM - (skip?.skip_ascent_m ?? 0))} m
      </span>
      <span className="inline-flex items-center gap-1">
        <UiIcon name="clock" size={16} />
        {formatDuration(joinedMinutes(durationMin, skip))}
      </span>
      <span className="font-sans text-[13px] font-medium text-[var(--muted)]">{DIFFICULTY_LABEL[difficulty].toLowerCase()}</span>
      {familyFriendly && <span className="font-sans text-[13px] font-semibold text-[var(--ok)]">vhodné pre deti</span>}
      {skip && (
        <span className="w-full font-sans text-[13px] text-[var(--muted)]">
          {transit ? "Od zastávky" : "Od vybraného parkoviska"}, bez úseku trasy pod ním.
        </span>
      )}
    </p>
  );
}
