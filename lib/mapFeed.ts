import type { GeoJSONSource } from "maplibre-gl";

/** Points per message to the map's worker: about 10 ms of copying on a mid-range phone. */
const POINTS_PER_STEP = 8000;

/**
 * Adds lines to a map source a small batch at a time. The map copies whatever
 * it is handed in one go, and copying a whole area of lines at once froze
 * zooming in on phones for a moment (2026-10-14). Batches go one after
 * another, each when the map has taken the previous one, so a frame is never
 * held up for long and only the tiles the new lines touch are redrawn.
 */
export function lineFeeder(source: () => GeoJSONSource | undefined): (features: GeoJSON.Feature[]) => Promise<void> {
  let nextId = 0;
  let queue = Promise.resolve();
  return (features) => {
    let batch: GeoJSON.Feature[] = [];
    let points = 0;
    const send = (add: GeoJSON.Feature[]) => {
      queue = queue.then(() => source()?.updateData({ add }, true)).catch(() => {});
    };
    for (const f of features) {
      // The map tells added lines apart by id.
      f.id = nextId++;
      batch.push(f);
      points += f.geometry.type === "LineString" ? f.geometry.coordinates.length : 1;
      if (points >= POINTS_PER_STEP) {
        send(batch);
        batch = [];
        points = 0;
      }
    }
    if (batch.length) send(batch);
    // Settles once the map has taken every batch of these lines.
    return queue;
  };
}
