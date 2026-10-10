"use client";

import { useState } from "react";
import { longDay } from "@/lib/days";
import { sharePath, shareText, startTown } from "@/lib/links";
import type { DayPlan } from "@/lib/dayPlan";
import type { Difficulty } from "@/lib/types";
import { useUserLocation } from "@/lib/userLocation";

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
 * "Poslať partii": the phone's share sheet with a chat-ready plan and a link
 * that opens the same day and departure. Desktop falls back to copying.
 * The start goes out as a town name only, never coordinates.
 */
export function ShareButton({ plan, date, time, hikeMin, hasDrive, label = "Poslať partii", className, onShared, ...trip }: Props) {
  const { start, fix } = useUserLocation();
  const [copied, setCopied] = useState(false);

  async function share() {
    if (!plan || !date || !time) return;
    const town = startTown(start, fix?.town);
    const url = new URL(sharePath(trip.slug, date, time, town), window.location.origin).toString();
    const back = hasDrive ? plan.segments[plan.segments.length - 1].end : plan.hikeEnd;
    const text = shareText({
      name: trip.name,
      dayLabel: longDay(date),
      departure: plan.segments[0].start,
      back,
      hasDrive,
      town,
      hikeMin,
      difficulty: trip.difficulty,
      familyFriendly: trip.familyFriendly,
      url,
    });
    // The URL is already the text's last line; passing it twice duplicates it in most chat apps.
    if (navigator.share) {
      try {
        await navigator.share({ text });
        onShared?.();
      } catch {
        // Closed the sheet: nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
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
