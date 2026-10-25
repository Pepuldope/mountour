"use client";

import { useState } from "react";
import type { Fit, Timing } from "@/lib/reviewLimits";
import "@/lib/legacyStorage";

const REVIEWER_KEY = "turuj-reviewer";

/** A random id this browser keeps, so a second review of a trip replaces the first (nothing about the person). */
function reviewerId(): string {
  try {
    let id = localStorage.getItem(REVIEWER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(REVIEWER_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const FIT_LABEL: [Fit, string][] = [
  ["popis", "Podľa popisu"],
  ["tazsie", "Ťažšie, ako sme čakali"],
  ["lahsie", "Ľahšie, ako sme čakali"],
];

const TIMING_LABEL: [Timing, string][] = [
  ["sedeli", "Sedeli"],
  ["dlhsie", "Trvalo nám to dlhšie"],
  ["kratsie", "Boli sme rýchlejší"],
];

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-[14px] font-semibold ${on ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]" : "border-[var(--border)] bg-[var(--card-bg)]"}`;

/**
 * The quick review after a trip (Peter, 2026-10-22: under a minute; 2026-10-23: four questions
 * at most, only stars and choices, no typing): stars, did it match the description, did the
 * plan's times hold, was it crowded. A centred sheet over the page.
 */
export function ReviewSheet({ slug, name, onDone }: { slug: string; name: string; onDone: (sent: boolean) => void }) {
  const [stars, setStars] = useState(0);
  const [fit, setFit] = useState<Fit | null>(null);
  const [crowded, setCrowded] = useState<boolean | null>(null);
  const [timing, setTiming] = useState<Timing | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");

  async function send() {
    setState("sending");
    try {
      const r = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reviewer: reviewerId(), stars, fit, crowded, timing }),
      });
      if (!r.ok) throw new Error(String(r.status));
      onDone(true);
    } catch {
      setState("error");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Hodnotenie: ${name}`} className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
      <div className="flex w-full max-w-[420px] flex-col gap-4 rounded-[var(--radius-card)] bg-[var(--card-bg)] p-5 shadow-[var(--shadow-float)]">
        <div>
          <h2 className="text-lg font-extrabold">Aký bol výlet?</h2>
          <p className="text-sm text-[var(--muted)]">{name} · zaberie to pár sekúnd</p>
        </div>
        <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Hviezdičky">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} z 5`}
              onClick={() => setStars(n)}
              className={`text-[38px] leading-none transition-transform active:scale-90 ${n <= stars ? "text-[#f5b301]" : "text-[var(--border)]"}`}
            >
              ★
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-[var(--muted)]">Trasa bola</span>
          <div className="flex flex-wrap gap-1.5">
            {FIT_LABEL.map(([f, label]) => (
              <button key={f} type="button" aria-pressed={fit === f} onClick={() => setFit(fit === f ? null : f)} className={chip(fit === f)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-[var(--muted)]">Časy z nášho plánu</span>
          <div className="flex flex-wrap gap-1.5">
            {TIMING_LABEL.map(([t, label]) => (
              <button key={t} type="button" aria-pressed={timing === t} onClick={() => setTiming(timing === t ? null : t)} className={chip(timing === t)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-[var(--muted)]">Bolo tam veľa ľudí?</span>
          <div className="flex gap-1.5">
            {([true, false] as const).map((v) => (
              <button key={String(v)} type="button" aria-pressed={crowded === v} onClick={() => setCrowded(crowded === v ? null : v)} className={chip(crowded === v)}>
                {v ? "Áno" : "Nie"}
              </button>
            ))}
          </div>
        </div>
        {state === "error" && <p className="text-sm text-[var(--danger)]">Nepodarilo sa odoslať. Skúste to o chvíľu.</p>}
        <div className="flex justify-between gap-2">
          <button type="button" onClick={() => onDone(false)} className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold">
            Teraz nie
          </button>
          <button
            type="button"
            disabled={stars === 0 || state === "sending"}
            onClick={send}
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--accent-contrast)] disabled:opacity-40"
          >
            {state === "sending" ? "Odosielam…" : "Odoslať"}
          </button>
        </div>
      </div>
    </div>
  );
}
