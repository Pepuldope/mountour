"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so the map is client-only.
export const TrailMap = dynamic(() => import("@/components/TrailMap").then((m) => m.TrailMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[var(--card-bg)]" />,
});
