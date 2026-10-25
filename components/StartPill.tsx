"use client";

import { useEffect, useState } from "react";
import { StartChip } from "@/components/StartChip";
import { UiIcon } from "@/components/UiIcon";
import { useUserLocation } from "@/lib/userLocation";

/**
 * The trip page's first line under the header (Peter, 2026-10-19, option B): where the day is
 * planned from, and "Zmeniť štart" opening the same start picker as a panel from the bottom.
 */
export function StartPill() {
  const { start, ready } = useUserLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex max-w-full min-w-0 items-center gap-1.5 self-start rounded-full border border-[var(--border)] bg-[var(--card-bg)] py-1.5 pr-3.5 pl-2.5 text-sm font-semibold shadow-[var(--shadow-float)]"
      >
        <span className="shrink-0 text-[var(--accent)]">
          <UiIcon name="pin" size={16} />
        </span>
        <span className="min-w-0 truncate">
          <span className="font-medium text-[var(--muted)]">Štart:</span> {ready && start ? start.label.split(",")[0] : ready ? "nevybraný" : "…"}
        </span>
        <span className="shrink-0 pl-1 font-bold text-[var(--accent)]">{ready && !start ? "Vybrať štart" : "Zmeniť štart"}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Odkiaľ vyrážate">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[20px] bg-[var(--card-bg)] px-4 pt-[18px] pb-[max(28px,env(safe-area-inset-bottom))] shadow-[var(--shadow-float)] lg:w-[460px]">
            <StartChip onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
