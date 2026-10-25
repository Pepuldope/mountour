"use client";

import { useState } from "react";
import { longDay } from "@/lib/days";
import { parkingPlace, sharePath, shareText } from "@/lib/links";
import type { DayPlan } from "@/lib/dayPlan";
import type { Difficulty } from "@/lib/types";
import { useTripSettings } from "@/lib/tripSettings";
import { useTripAccess } from "@/components/TripAccess";
import { sinceArrival, track } from "@/lib/analytics";
import { clock } from "@/lib/zoned";
import { stopLabel } from "@/lib/format";

export interface ShareInfo {
  slug: string;
  name: string;
  difficulty: Difficulty;
  familyFriendly: boolean;
}

interface Props extends ShareInfo {
  plan: DayPlan | null;
  date: string | null;
  time: string | null;
  hikeMin: number;
  hasDrive: boolean;
  label?: string;
  className?: string;
  /** After the share sheet closes or the text is copied. */
  onShared?: () => void;
}

/**
 * "Poslať partii": the phone's share sheet with a chat-ready plan and a link. Desktop falls back to copying.
 * Friends leave from different places (Peter, 2026-10-22), so what goes out is the day and the meeting
 * time where the walk starts, never the sender's start; each friend's page works out their own departure.
 */
export function ShareButton({ plan, date, time, hikeMin, hasDrive, label = "Poslať partii", className, onShared, ...trip }: Props) {
  const { withKids } = useTripSettings();
  const { transit, choice, stopChoice, parking, stop } = useTripAccess();
  const [copied, setCopied] = useState(false);

  async function share() {
    if (!plan || !date || !time) return;
    // Met at a stop by bus, at the parking by car; walking there (or no start), at the trail.
    const byStop = hasDrive && transit && stop !== null;
    const atParking = hasDrive && !transit;
    const url = new URL(
      sharePath(trip.slug, { date, meet: clock(plan.hikeStart), transit: byStop, withKids, pick: byStop ? stopChoice : choice }),
      window.location.origin
    ).toString();
    const text = shareText({
      name: trip.name,
      dayLabel: longDay(date),
      withKids,
      meet: plan.hikeStart,
      place: byStop ? `na zastávke ${stopLabel(stop.name)}` : atParking ? parkingPlace(parking?.name ?? null) : null,
      end: plan.hikeEnd,
      endPlace: byStop ? "stop" : atParking ? "car" : null,
      inDaylight: plan.verdict === "ok" || plan.verdict === "close" || plan.verdict === "tight",
      hikeMin,
      difficulty: trip.difficulty,
      url,
    });
    // The URL is already the text's last line; passing it twice duplicates it in most chat apps.
    track("share", { trail: trip.slug, took: sinceArrival() });
    if (navigator.share) {
      try {
        await navigator.share({ text });
        track("share_sent", { trail: trip.slug, how: "sheet", took: sinceArrival() });
        onShared?.();
      } catch {
        // Closed the sheet: nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      track("share_sent", { trail: trip.slug, how: "copy", took: sinceArrival() });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onShared?.();
    } catch {
      window.prompt("Skopírujte plán:", text);
    }
  }

  return (
    <button type="button" onClick={share} disabled={!plan} className={className}>
      {copied ? "Skopírované, vložte do chatu" : label}
    </button>
  );
}
