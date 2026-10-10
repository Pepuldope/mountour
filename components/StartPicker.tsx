"use client";

import { useRef, useState } from "react";
import { searchPlaces } from "@/lib/geocode";
import type { Place } from "@/lib/geocode";
import { useUserLocation } from "@/lib/userLocation";

type SearchState = "idle" | "searching" | "results" | "empty" | "error";

/** "Odkiaľ vyrážam": typed place (searched on Enter) or GPS. Shared by home and trip pages. */
export function StartPicker() {
  const { status, message, locate, start, setManualStart } = useUserLocation();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>("idle");
  const [results, setResults] = useState<Place[]>([]);
  const abortRef = useRef<AbortController | null>(null);

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
  }

  return (
    <div className="flex flex-col gap-1 text-sm font-medium">
      <label htmlFor="start-from">Odkiaľ vyrážam</label>

      {start && (
        <p className="flex items-center gap-2 text-sm font-normal">
          <span className="min-w-0 flex-1 truncate">
            <span className="opacity-60">Štart: </span>
            <strong>{start.label}</strong>
          </span>
          {start.source === "manual" && (
            <button
              type="button"
              onClick={() => setManualStart(null)}
              className="shrink-0 text-xs text-[var(--accent)] underline"
            >
              zrušiť
            </button>
          )}
        </p>
      )}

      <div className="flex gap-2">
        <input
          id="start-from"
          type="search"
          enterKeyHint="search"
          placeholder={start ? "Zmeniť miesto (Enter)" : "napr. Bratislava (Enter)"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
        />
        <button
          type="button"
          onClick={locate}
          disabled={status === "locating"}
          className="whitespace-nowrap rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
        >
          {status === "locating" ? "Hľadám..." : "Moja poloha"}
        </button>
      </div>

      {search === "searching" && <p className="text-xs font-normal opacity-70">Hľadám miesto...</p>}
      {search === "empty" && <p className="text-xs font-normal text-[var(--warn)]">Také miesto sme nenašli.</p>}
      {search === "error" && (
        <p className="text-xs font-normal text-[var(--warn)]">Vyhľadávanie zlyhalo. Skús to znova.</p>
      )}
      {search === "results" && (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)] font-normal">
          {results.map((p) => (
            <li key={`${p.lat},${p.lon}`} className="border-b border-[var(--border)] last:border-b-0">
              <button
                type="button"
                onClick={() => choose(p)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--ok-bg)]"
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && status !== "locating" && (
        <p role="status" className="text-xs font-normal text-[var(--warn)]">
          {message}
        </p>
      )}
    </div>
  );
}
