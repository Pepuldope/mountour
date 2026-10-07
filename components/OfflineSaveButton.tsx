"use client";

import { useState } from "react";
import type { BBox } from "@/lib/types";
import { tileUrlsForBbox } from "@/lib/tiles";

interface Props {
  slug: string;
  gpxUrl: string | null;
  bbox: BBox | null;
}

type Status = "idle" | "saving" | "done" | "error" | "unsupported";

export function OfflineSaveButton({ slug, gpxUrl, bbox }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function save() {
    if (!("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }

    setStatus("saving");
    const reg = await navigator.serviceWorker.ready;

    const urls = [
      window.location.href,
      ...(gpxUrl ? [gpxUrl] : []),
      ...(bbox ? tileUrlsForBbox(bbox) : []),
    ];

    const channel = new MessageChannel();
    const donePromise = new Promise<void>((resolve, reject) => {
      channel.port1.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === "PROGRESS") setProgress({ done: msg.done, total: msg.total });
        if (msg.type === "DONE") {
          setProgress({ done: msg.done, total: msg.total });
          resolve();
        }
      };
      setTimeout(() => reject(new Error("timeout")), 120000);
    });

    reg.active?.postMessage({ type: "CACHE_TRIP", slug, urls }, [channel.port2]);

    try {
      await donePromise;
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={save}
        disabled={status === "saving"}
        className="rounded-lg bg-[var(--accent)] px-4 py-3 text-base font-semibold text-[var(--accent-contrast)] disabled:opacity-60"
      >
        {status === "saving"
          ? `Ukladam... (${progress.done}/${progress.total || "?"})`
          : status === "done"
            ? "Ulozene offline"
            : "Ulozit vylet offline"}
      </button>
      {status === "error" && (
        <p className="text-sm text-[var(--warn)]">Ulozenie sa nepodarilo, skus to znova.</p>
      )}
      {status === "unsupported" && (
        <p className="text-sm text-[var(--warn)]">Tento prehliadac nepodporuje offline ulozenie.</p>
      )}
    </div>
  );
}
