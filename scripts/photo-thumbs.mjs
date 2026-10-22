// Small photo per trip for the home cards (npm runs it in "prebuild"): the trip
// list carries no OSM ids, so this joins public/data/photos.json (by place) with
// the trip index (slug -> place) into public/data/photo-thumbs.json, slug -> a
// 250 px Commons thumbnail (one of Commons' standard steps, half the trip page's).
import { readFileSync, writeFileSync } from "node:fs";

const read = (f) => {
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};
const photos = read("public/data/photos.json")?.photos ?? {};
const trips = read("public/data/trips/index.json")?.trips ?? [];
const thumbs = {};
for (const t of trips) {
  const p = photos[t.destination?.osm ?? `trip/${t.slug}`];
  if (p) thumbs[t.slug] = p.url.replace("/500px-", "/250px-");
}
writeFileSync("public/data/photo-thumbs.json", JSON.stringify(thumbs));
console.log(`Card photos: ${Object.keys(thumbs).length} of ${trips.length} trips`);
