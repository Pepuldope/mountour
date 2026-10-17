"use client";

import { DIFFICULTY_LABEL, formatDuration } from "@/lib/format";
import type { Difficulty } from "@/lib/types";
import { useTripSettings } from "@/lib/tripSettings";
import { formatKm, walkMinutes } from "@/lib/walkFacts";
import { useTripAccess } from "@/components/TripAccess";
import { UiIcon } from "@/components/UiIcon";

interface Props {
  difficulty: Difficulty;
  familyFriendly: boolean;
}

/** Length, climb and walking time of the walk the day counts: from the parking or stop, at the group's pace. */
export function TripFacts({ difficulty, familyFriendly }: Props) {
  const { walk, transit } = useTripAccess();
  const { withKids } = useTripSettings();
  return (
    <p className="font-data flex flex-wrap items-center gap-x-3.5 text-[17px]">
      <span>{formatKm(walk.m)}</span>
      <span className="inline-flex items-center gap-1">
        <UiIcon name="up" size={16} />
        {walk.ascentM} m
      </span>
      <span className="inline-flex items-center gap-1">
        <UiIcon name="clock" size={16} />
        {formatDuration(walkMinutes(walk, withKids))}
      </span>
      <span className="font-sans text-[13px] font-medium text-[var(--muted)]">{DIFFICULTY_LABEL[difficulty].toLowerCase()}</span>
      {familyFriendly && <span className="font-sans text-[13px] font-semibold text-[var(--ok)]">vhodné pre deti</span>}
      {(walk.skipped || walk.approachMin > 0 || withKids) && (
        <span className="w-full font-sans text-[13px] text-[var(--muted)]">{factsNote(walk.skipped, walk.approachMin > 0, transit, withKids)}</span>
      )}
    </p>
  );
}

/** What the numbers count, in one line. */
function factsNote(skipped: boolean, approach: boolean, transit: boolean, withKids: boolean): string {
  const parts: string[] = [];
  if (skipped) parts.push(`${transit ? "Od zastávky" : "Od vybraného parkoviska"}, bez úseku trasy pod ním.`);
  else if (approach) parts.push(`Aj s chôdzou ${transit ? "od zastávky" : "od parkoviska"} k trase a späť.`);
  if (withKids) parts.push("Čas v tempe s deťmi.");
  return parts.join(" ");
}
