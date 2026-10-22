/** Farthest start (straight line) from which Pešo is offered: about half an hour on foot. */
export const WALK_THERE_MAX_M = 2500;
/** Paths wind: the walk is about this much longer than the straight line. */
const DETOUR = 1.3;
const KMH = 4.5;

/** Minutes on foot from the start to the trail, rounded up to 5; null when it's too far to offer. */
export function walkThereMinutes(straightM: number): number | null {
  if (straightM > WALK_THERE_MAX_M) return null;
  return Math.max(5, Math.ceil(((straightM * DETOUR) / 1000 / KMH) * 60 / 5) * 5);
}
