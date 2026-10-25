// The site was called MounTour until 2026-10-25 and its browser storage keys
// started with "mountour-". Copy them once to the "turuj-" names so saved trips,
// the start town and settings survive the rename. Runs when this module is first
// imported, before any component reads storage. Trip caches move in public/sw.js.
const OLD = "mount" + "our-";
const NEW = "turuj-";

function move(store: Storage) {
  for (const key of Object.keys(store)) {
    if (!key.startsWith(OLD)) continue;
    const next = NEW + key.slice(OLD.length);
    const value = store.getItem(key);
    if (value !== null && store.getItem(next) === null) store.setItem(next, value);
    store.removeItem(key);
  }
}

if (typeof window !== "undefined") {
  for (const get of [() => localStorage, () => sessionStorage]) {
    try {
      move(get());
    } catch {
      // Storage blocked: nothing to move.
    }
  }
}

export {};
