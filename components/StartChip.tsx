"use client";

import { useRef, useState } from "react";
import { searchPlaces } from "@/lib/geocode";
import type { Place } from "@/lib/geocode";
import { TOWNS } from "@/lib/towns";
import { useUserLocation } from "@/lib/userLocation";

type SearchState = "idle" | "searching" | "results" | "empty" | "error";

const chip =
  "rounded-[var(--radius-chip)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]";

/**
 * "Odkiaľ vyrážate?": one chip that opens location / town chips / search.
 * The list already works without a start; this only adds travel times.
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="opacity-80">{start ? "Odkiaľ:" : "Odkiaľ vyrážate?"}</span>
        {start && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`${chip} border-[var(--accent)] text-[var(--accent)]`}
          >
            {start.source === "gps" ? "📍 " : ""}
            {start.label.split(",")[0]} <span aria-hidden="true">▾</span>
          </button>
        )}
      </div>

      {expanded && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                locate();
                setOpen(false);
              }}
              disabled={status === "locating"} className={chip}>
              {status === "locating" ? "Hľadám..." : "📍 Moja poloha"}
            </button>
            {TOWNS.slice(0, 4).map((t) => (
              <button key={t.label} type="button" onClick={() => choose(t)} className={chip}>
                {t.label}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
          >
            <label htmlFor="start-from" className="sr-only">
              Iné miesto
            </label>
            <input
              id="start-from"
              type="search"
              enterKeyHint="search"
              placeholder="Iné miesto, napr. Pezinok"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-base"
            />
            <button type="submit" className={chip}>
              Hľadať
            </button>
          </form>
          {search === "searching" && <p className="text-xs opacity-70">Hľadám miesto...</p>}
          {search === "empty" && <p className="text-xs text-[var(--warn)]">Také miesto sme nenašli.</p>}
          {search === "error" && <p className="text-xs text-[var(--warn)]">Toto sa nenačítalo. Skúste to znova.</p>}
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
        <p role="status" className="text-xs text-[var(--warn)]">
          {message}
        </p>
      )}
    </div>
  );
}
