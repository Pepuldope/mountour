"use client";

import Link from "next/link";
import { useSavedTrips } from "@/lib/savedTrips";

/** Nav entry with the number of trips saved on this device. */
export function SavedTripsLink() {
  const { trips } = useSavedTrips();
  return (
    <Link
      href="/ulozene"
      className="inline-flex w-fit items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]"
    >
      Uložené výlety
      {trips.length > 0 && (
        <span className="rounded-full bg-[var(--accent)] px-2 text-xs text-[var(--accent-contrast)]">
          {trips.length}
        </span>
      )}
    </Link>
  );
}
