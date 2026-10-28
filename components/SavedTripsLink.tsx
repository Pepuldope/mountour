"use client";

import { useSavedTrips } from "@/lib/savedTrips";
import { LangLink, useT } from "@/lib/i18n";

/** Nav entry with the number of trips saved on this device. */
export function SavedTripsLink() {
  const { trips } = useSavedTrips();
  const t = useT();
  return (
    <LangLink
      href="/ulozene"
      className="inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-[var(--radius-chip)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]"
    >
      {t("Moje výlety")}
      {trips.length > 0 && (
        <span className="rounded-full bg-[var(--accent)] px-2 text-xs text-[var(--accent-contrast)]">
          {trips.length}
        </span>
      )}
    </LangLink>
  );
}
