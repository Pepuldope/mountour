/** What a quick review may say (shared by the review sheet and lib/reviews.ts). */
export const FITS = ["popis", "tazsie", "lahsie"] as const;
export type Fit = (typeof FITS)[number];
export const NOTE_MAX = 280;
