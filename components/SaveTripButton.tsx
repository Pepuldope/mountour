"use client";

import { useState } from "react";
import Link from "next/link";
import type { BBox, LatLng } from "@/lib/types";
import { tileUrlsForBbox } from "@/lib/tiles";
import { formatDateSk } from "@/lib/format";
import { useSavedTrips } from "@/lib/savedTrips";
import { useTripSettings } from "@/lib/tripSettings";
import { useTripPlan } from "@/lib/useTripPlan";
import { useUserLocation } from "@/lib/userLocation";
import { track } from "@/lib/analytics";

interface Props {
  slug: string;
  name: string;
  gpxUrl: string | null;
  bbox: BBox | null;
  sun: LatLng | null;
  destination: LatLng | null;
  hikeMin: number;
}

type Status = "idle" | "saving" | "error";

/** Build assets this page is running on, so the offline copy can still hydrate. */
function loadedAssetUrls(): string[] {
  return performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => new URL(u).pathname.startsWith("/_next/static/"));
}

/** Ask the service worker to store these URLs. */
async function cacheTrip(slug: string, urls: string[], onProgress: (done: number, total: number) => void) {
  const reg = await navigator.serviceWorker.ready;
  const channel = new MessageChannel();
  const done = new Promise<void>((resolve, reject) => {
    channel.port1.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "PROGRESS") onProgress(msg.done, msg.total);
      if (msg.type === "DONE") resolve();
    };
    setTimeout(() => reject(new Error("timeout")), 120000);
  });
  reg.active?.postMessage({ type: "CACHE_TRIP", slug, urls }, [channel.port2]);
  await done;
}

/**
 * "Uložiť výlet": one action that both remembers the trip (Uložené výlety, this
 * device only) and stores it for offline use. A saved trip = a cached trip.
 */
export function SaveTripButton({ slug, name, gpxUrl, bbox, sun, destination, hikeMin }: Props) {
  const { trips, save, patch, remove } = useSavedTrips();
  const { date, time } = useTripSettings();
  const { start } = useUserLocation();
  const { route } = useTripPlan(sun, destination, hikeMin);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const saved = trips.find((t) => t.slug === slug) ?? null;
  const changed =
    saved !== null && (saved.date !== date || saved.time !== time || (saved.start?.label ?? null) !== (start?.label ?? null));

  async function onSave() {
    if (!date || !time || !sun) return;
    setStatus("saving");
    track("trip_saved", { trail: slug });
    save({
      slug,
      name,
      date,
      time,
      start: start ? { lat: start.lat, lon: start.lon, label: start.label } : null,
      driveMin: route?.durationMin ?? null,
      hikeMin,
      sun,
      savedAt: new Date().toISOString(),
      offline: "pending",
    });

    if (!("serviceWorker" in navigator)) {
      patch(slug, { offline: "failed" });
      setStatus("idle");
      return;
    }
    const urls = [
      `/trasa/${slug}`,
      ...(gpxUrl ? [gpxUrl] : []),
      ...loadedAssetUrls(),
      ...(bbox ? tileUrlsForBbox(bbox) : []),
    ];
    try {
      await cacheTrip(slug, urls, (d, t) => setProgress({ done: d, total: t }));
      patch(slug, { offline: "ok" });
      setStatus("idle");
    } catch {
      patch(slug, { offline: "failed" });
      setStatus("error");
    }
  }

  const showButton = !saved || changed || saved.offline !== "ok" || status === "saving";

  return (
    <div className="flex flex-col gap-2">
      {saved && status !== "saving" && (
        <p className="text-sm">
          Uložené na <strong>{formatDateSk(saved.date)}</strong> o <strong>{saved.time}</strong>
          {saved.offline === "ok"
            ? " - dostupné aj offline. "
            : saved.offline === "failed"
              ? " - offline kópia sa nepodarila. "
              : ". "}
          <Link href="/ulozene" className="text-[var(--accent)] underline">
            Uložené výlety
          </Link>
        </p>
      )}

      {showButton && (
        <button
          type="button"
          onClick={onSave}
          disabled={status === "saving" || !date || !time}
          className="rounded-lg bg-[var(--accent)] px-4 py-3 text-base font-semibold text-[var(--accent-contrast)] disabled:opacity-60"
        >
          {status === "saving"
            ? `Ukladám... (${progress.done}/${progress.total || "?"})`
            : saved
              ? "Uložiť zmeny"
              : "Uložiť výlet"}
        </button>
      )}

      {saved && status !== "saving" && (
        <button type="button" onClick={() => remove(slug)} className="w-fit text-sm text-[var(--warn)] underline">
          Odstrániť z uložených
        </button>
      )}

      {status === "error" && (
        <p className="text-sm text-[var(--warn)]">
          Výlet je uložený, ale offline kópiu sa nepodarilo vytvoriť. Skús to znova so signálom.
        </p>
      )}
    </div>
  );
}
