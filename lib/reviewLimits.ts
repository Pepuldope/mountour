/** What a quick review may say (shared by the review sheet and lib/reviews.ts). */
export const FITS = ["popis", "tazsie", "lahsie"] as const;
export type Fit = (typeof FITS)[number];
/** Did the plan's times hold (Peter 2026-10-23: choices only, so we learn if our walking times are right). */
export const TIMINGS = ["sedeli", "dlhsie", "kratsie"] as const;
export type Timing = (typeof TIMINGS)[number];
export const NOTE_MAX = 280;
