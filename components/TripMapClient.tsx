"use client";

import dynamic from "next/dynamic";

export const TripMap = dynamic(() => import("@/components/TripMap").then((m) => m.TripMap), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-xl border border-[var(--border)] bg-[var(--card-bg)]" />
  ),
});
