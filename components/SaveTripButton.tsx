"use client";

import { useState } from "react";
import Link from "next/link";
import type { BBox, LatLng } from "@/lib/types";
import { offlineMapUrls } from "@/lib/tiles";
import { longDay } from "@/lib/days";
import { useSavedTrips } from "@/lib/savedTrips";
import { useTripPlan } from "@/lib/useTripPlan";
import { useUserLocation } from "@/lib/userLocation";
import { track } from "@/lib/analytics";
import { ShareButton } from "@/components/ShareButton";
import type { ShareInfo } from "@/components/ShareButton";

interface Props extends ShareInfo {
  gpxUrl: string | null;
  bbox: BBox | null;
  sun: LatLng | null;
  destination: LatLng | null;
  /** Walking time before the kids pace. */
  baseHikeMin: number;
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

const primary =
  "w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-base font-bold text-[var(--accent-contrast)] disabled:opacity-60";
const secondary =
  "rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--accent)]";

/**
 * "Uložiť výlet" is the main button (PD2): it remembers the trip on this
 * device and stores it for offline use. Right after saving, one tap offers to
 * send the plan to the group.
 */
export function SaveTripButton({ gpxUrl, bbox, sun, destination, baseHikeMin, ...trip }: Props) {
  const { slug, name } = trip;
  const { trips, save, patch, remove } = useSavedTrips();
  const { start } = useUserLocation();
  const { plan, date, time, hikeMin, driveMin, route } = useTripPlan(sun, destination, baseHikeMin);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [askShare, setAskShare] = useState(false);

  const saved = trips.find((t) => t.slug === slug) ?? null;
  const changed =
    saved !== null &&
    (saved.date !== date || saved.time !== time || (saved.start?.label ?? null) !== (start?.label ?? null));

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
      driveMin,
      hikeMin,
      sun,
      savedAt: new Date().toISOString(),
      offline: "pending",
    });
    setAskShare(true);

    if (!("serviceWorker" in navigator)) {
      patch(slug, { offline: "failed" });
      setStatus("idle");
      return;
    }
    const urls = [
      `/trasa/${slug}`,
      ...(gpxUrl ? [gpxUrl] : []),
      ...loadedAssetUrls(),
      ...(bbox ? await offlineMapUrls(bbox) : []),
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

  const showButton = !saved || changed || saved.offline === "failed" || status === "saving";
  const share = (
    <ShareButton
      {...trip}
      plan={plan}
      date={date}
      time={time}
      hikeMin={hikeMin}
      hasDrive={route !== null || driveMin !== null}
      className={secondary}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {showButton && (
        <button type="button" onClick={onSave} disabled={status === "saving" || !date || !time} className={primary}>
          {status === "saving"
            ? `Ukladám aj na cestu bez signálu... (${progress.done}/${progress.total || "?"})`
            : saved
              ? "Uložiť zmeny"
              : "Uložiť výlet"}
        </button>
      )}

      {saved && askShare && (
        <div role="status" className="flex flex-col gap-2 rounded-xl bg-[var(--ok-bg)] p-3 text-sm">
          <p>
            <strong>Uložené.</strong> Nájdete to v{" "}
            <Link href="/ulozene" className="underline">
              Mojich výletoch
            </Link>
            .
          </p>
          <p className="font-semibold">Poslať plán partii?</p>
          <div className="flex flex-wrap gap-2">
            <ShareButton
              {...trip}
              plan={plan}
              date={date}
              time={time}
              hikeMin={hikeMin}
              hasDrive={route !== null || driveMin !== null}
              className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--accent-contrast)]"
              onShared={() => setAskShare(false)}
            />
            <button type="button" onClick={() => setAskShare(false)} className="px-2 text-sm underline">
              Teraz nie
            </button>
          </div>
        </div>
      )}

      {saved && !askShare && status !== "saving" && (
        <p className="text-sm">
          Uložené na <strong>{longDay(saved.date)}</strong> o <strong>{saved.time}</strong>
          {saved.offline === "ok" ? ", funguje aj bez signálu. " : ". "}
          <button type="button" onClick={() => remove(slug)} className="text-[var(--muted)] underline">
            Odstrániť
          </button>
        </p>
      )}

      {status === "error" && (
        <p className="text-sm text-[var(--warn)]">
          Výlet je uložený, ale kópia bez signálu sa nepodarila. Skúste to znova so signálom.
        </p>
      )}

      {!askShare && share}
    </div>
  );
}
