import { getCloudflareContext } from "@opennextjs/cloudflare";
import { routeWalk, trailDetailFrom, walkFromCar } from "@/lib/data";
import { summaryFromList } from "@/lib/trips";
import type { TownDriveFile, TripDetail, TripIndex, TripList, TripSummary } from "@/lib/tripSchema";
import type { TrailDetail } from "@/lib/types";
import type { RouteWalk } from "@/lib/walkFacts";

// The trip files the weekly pipeline writes to public/data (docs/TRIP-DATA.md),
// read on the server. They are static assets, not part of the code bundle, so
// the number of trips doesn't count against Cloudflare's Worker size limit.
// On Cloudflare they come from the ASSETS binding; in local dev, tests and the
// build, from the disk. Server only.

interface AssetsBinding {
  fetch(req: Request): Promise<Response>;
}

// While `next build` prebuilds pages there is no Worker: asking for its bindings
// starts a local stand-in (workerd) per call, and with the town pages built ahead
// those collided on its SQLite files (SQLITE_BUSY, the 21 Oct branch builds).
const building = process.env.NEXT_PHASE === "phase-production-build";

async function readPublicJson<T>(path: string): Promise<T | null> {
  try {
    if (building) throw new Error("build");
    const { env } = await getCloudflareContext({ async: true });
    const assets = (env as unknown as Record<string, unknown>).ASSETS as AssetsBinding | undefined;
    if (assets) {
      const res = await assets.fetch(new Request(`https://assets.local/${path}`));
      if (res.ok) return (await res.json()) as T;
    }
  } catch {
    // Not on Cloudflare: read the disk below.
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return JSON.parse(await readFile(join(process.cwd(), "public", path), "utf8")) as T;
  } catch {
    return null;
  }
}

const SLUG = /^[a-z0-9-]{1,120}$/;
const EMPTY_INDEX: TripIndex = { version: 1, generated_at: "", osm_data_at: null, attribution: "", trips: [] };

let index: Promise<TripIndex> | null = null;

/** Every trip as a summary. Read once per server instance. */
export function getTripIndex(): Promise<TripIndex> {
  index ??= readPublicJson<TripIndex>("data/trips/index.json").then((i) => {
    if (!i) index = null; // try again next time
    return i ?? EMPTY_INDEX;
  });
  return index;
}

let walks: Promise<Map<string, number>> | null = null;

/**
 * Each trip's walk by car as the trip page counts it (lib/walkFacts.ts, kids pace aside). Built from
 * list.json, which carries where the parking joins the trail; index.json doesn't, and its bare
 * trail times differed from the trip pages (Velká Javorina 1 h 45 vs 35 min).
 */
export function getCarWalks(): Promise<Map<string, number>> {
  walks ??= readPublicJson<TripList>("data/trips/list.json").then((list) => {
    if (!list) walks = null;
    return new Map((list?.trips ?? []).map((t) => [t.slug, walkFromCar(summaryFromList(t))]));
  });
  return walks;
}

export async function getAllTrips(): Promise<TripSummary[]> {
  return (await getTripIndex()).trips;
}

/** Every trip in the shape the pages use, best known first. */
export async function getAllTrails(): Promise<TrailDetail[]> {
  return [...(await getAllTrips())].sort((a, b) => b.rank - a.rank).map(trailDetailFrom);
}

/** Full trip with path, alternatives and POIs, or null for an unknown slug. */
export async function getTrip(slug: string): Promise<TripDetail | null> {
  if (!SLUG.test(slug)) return null;
  return readPublicJson<TripDetail>(`data/trips/${slug}.json`);
}

/**
 * Every trip's slug, main routes and other routes alike, from the files on disk.
 * Build only: the trip pages are drawn ahead from this list (app/trasa/[slug]/page.tsx).
 */
export async function getAllTripSlugs(): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const files = await readdir(join(process.cwd(), "public", "data", "trips"));
  return files
    .filter((f) => f.endsWith(".json") && f !== "index.json" && f !== "list.json")
    .map((f) => f.slice(0, -".json".length))
    .filter((slug) => SLUG.test(slug))
    .sort();
}

/** A free-licence photo of a trip's destination from Wikimedia Commons (pipeline/photos.py). */
export interface PlacePhoto {
  url: string;
  w: number;
  h: number;
  author: string;
  license: string;
  /** Link to the licence text, from Commons (older files: none, the page links known CC licences itself). */
  license_url?: string | null;
  page: string;
}

let photos: Promise<Record<string, PlacePhoto>> | null = null;

/** Destination photos by OSM id ("node/123"), or "trip/<slug>" for hand-made trips; empty when the file is missing. */
export function getPhotos(): Promise<Record<string, PlacePhoto>> {
  photos ??= readPublicJson<{ photos: Record<string, PlacePhoto> }>("data/photos.json").then((f) => f?.photos ?? {});
  return photos;
}

let photoKeys: Promise<Record<string, string>> | null = null;

/** The photo of a trip's place, by slug (via public/data/photo-keys.json, made before each build); null when none. */
export async function getTripPhoto(slug: string, osm?: string | null): Promise<PlacePhoto | null> {
  photoKeys ??= readPublicJson<Record<string, string>>("data/photo-keys.json").then((f) => f ?? {});
  const all = await getPhotos();
  return all[osm ?? (await photoKeys)[slug] ?? `trip/${slug}`] ?? null;
}

/** Car minutes from one precomputed town to every trip, by slug; empty for an unknown town. */
export async function getTownDrives(townId: string): Promise<TownDriveFile["minutes"]> {
  if (!SLUG.test(townId)) return {};
  return (await readPublicJson<TownDriveFile>(`data/drive/${townId}.json`))?.minutes ?? {};
}

/** The walk from the default parking and stop for each route of a place, as each route's own page counts it. */
export async function getRouteWalks(slugs: string[]): Promise<Record<string, RouteWalk>> {
  const out: Record<string, RouteWalk> = {};
  await Promise.all(
    slugs.map(async (slug) => {
      const trip = await getTrip(slug);
      if (trip) out[slug] = routeWalk(trailDetailFrom(trip));
    })
  );
  return out;
}
