"use client";

import { useRef, useState } from "react";
import { searchPlaces } from "@/lib/geocode";
import type { Place } from "@/lib/geocode";
import { TOWNS } from "@/lib/towns";
import { useUserLocation } from "@/lib/userLocation";
import { UiIcon } from "@/components/UiIcon";

type SearchState = "idle" | "searching" | "results" | "empty" | "error";

// Notes sit on a card.
const note = "w-fit rounded-lg bg-[var(--card-bg)] px-2.5 py-1.5 text-xs font-medium";

/**
 * "Odkiaľ vyrážate?" as the page's first question: a card open until a start is
 * picked (my location, one of six cities, or any place by search), then one
 * line "Vyrážate z … Zmeniť". The list works without a start; a start adds
 * travel times and sorts by them.
 */
export function StartChip() {
  const { status, message, locate, start, setManualStart } = useUserLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>("idle");
  const [results, setResults] = useState<Place[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const expanded = open || !start;

  async function runSearch() {
    if (query.trim().length < 2) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearch("searching");
    try {
      const found = await searchPlaces(query, ctrl.signal);
      setResults(found);
      setSearch(found.length ? "results" : "empty");
    } catch (err) {
      if ((err as Error).name !== "AbortError") setSearch("error");
    }
  }

  function choose(place: Place) {
    setManualStart(place);
    setResults([]);
    setSearch("idle");
    setQuery("");
    setOpen(false);
  }

  return (
    <section aria-label="Odkiaľ vyrážate" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)] p-3.5 shadow-[var(--shadow-float)]">
      {start && !open ? (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)]">
            <UiIcon name="pin" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-[12.5px] text-[var(--muted)]">Vyrážate z</span>
            <strong className="block truncate text-lg leading-tight">{start.label.split(",")[0]}</strong>
          </div>
          <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className="p-2 font-bold text-[var(--accent)]">
            Zmeniť
          </button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[19px] leading-tight font-bold">Odkiaľ vyrážate?</h2>
            <p className="mt-0.5 text-[13.5px] text-[var(--muted)]">Zoradíme výlety podľa cesty a ukážeme, kedy vyraziť.</p>
          </div>
          {start && (
            <button type="button" onClick={() => setOpen(false)} aria-label="Zavrieť" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--segment-bg)] text-[var(--muted)]">
              <UiIcon name="close" size={12} />
            </button>
          )}
        </div>
      )}

      {expanded && (
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              locate();
              setOpen(false);
            }}
            disabled={status === "locating"}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-base font-bold text-[var(--accent-contrast)] disabled:opacity-70"
          >
            <UiIcon name="pin" size={18} />
            {status === "locating" ? "Hľadám vašu polohu..." : "Použiť moju polohu"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            {TOWNS.slice(0, 6).map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => choose(t)}
                className={`h-11 truncate rounded-[10px] border bg-[var(--segment-bg)] px-3 text-left font-semibold hover:border-[var(--accent)] ${
                  start?.label === t.label ? "border-[var(--accent)]" : "border-[var(--border)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <form
            className="flex h-11 items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--card-bg)] px-3 focus-within:border-[var(--accent)]"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
          >
            <span className="text-[var(--muted)]">
              <UiIcon name="search" size={16} />
            </span>
            <label htmlFor="start-from" className="sr-only">
              Iné mesto alebo obec
            </label>
            <input
              id="start-from"
              type="search"
              enterKeyHint="search"
              placeholder="Iné mesto alebo obec, napr. Pezinok"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            {query.trim().length >= 2 && (
              <button type="submit" className="text-sm font-bold text-[var(--accent)]">
                Hľadať
              </button>
            )}
          </form>
      {search === "searching" && <p className={`${note} text-[var(--muted)]`}>Hľadám miesto...</p>}
          {search === "empty" && <p className={`${note} text-[var(--warn)]`}>Také miesto sme nenašli.</p>}
          {search === "error" && <p className={`${note} text-[var(--warn)]`}>Toto sa nenačítalo. Skúste to znova.</p>}
          {search === "results" && (
            <ul className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card-bg)]">
              {results.map((p) => (
                <li key={`${p.lat},${p.lon}`} className="border-b border-[var(--border)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => choose(p)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--background)]"
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {message && status !== "locating" && (
        <p role="status" className={`${note} text-[var(--warn)]`}>
          {message}
        </p>
      )}
    </section>
  );
}
