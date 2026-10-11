// Colours that carry meaning on the map and in lists, kept in one place so the
// visual identity work can swap them without touching the features.
// Current values follow the "Feel Lab" prototype (2026-10-11); not final.

/** Trail popularity, quiet (0) to busiest (4): pipeline/network.py levels. */
export const POPULARITY_RAMP = ["#fde4a0", "#f9bb47", "#ef8a2c", "#d9541f", "#a5301c"] as const;

export const POPULARITY_LABEL = ["málo chodená", "", "", "", "najobľúbenejšia"] as const;
