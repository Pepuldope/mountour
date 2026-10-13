"use client";

import { useSyncExternalStore } from "react";

// The route the pointer is on, shared by the route list and the trip map (desktop), so
// hovering either lights up both. Null when none.
let hovered: string | null = null;
const listeners = new Set<() => void>();

export function setHoveredRoute(slug: string | null) {
  if (slug === hovered) return;
  hovered = slug;
  for (const l of listeners) l();
}

export function useHoveredRoute(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => hovered,
    () => null
  );
}
