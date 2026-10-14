"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Difficulty, LatLng, TrailDetail } from "@/lib/types";
import { defaultApproachMin, driveDestination, nearestStop, primaryTrailhead, sunLocation, trailDetailFrom } from "@/lib/data";
import { activeClosures } from "@/lib/closures";
import { approachMin, hikeMinutes } from "@/lib/dayPlan";
import { dayFit, dayInSentence, isoDate } from "@/lib/days";
import { estimateDriveMin, transitMinutes } from "@/lib/drive";
import { DIFFICULTY_LABEL, GOAL_LABEL, GOAL_PLURAL, formatDurationShort } from "@/lib/format";
import { kindSvg } from "@/lib/kindIcons";
import { GOAL_COLOUR } from "@/lib/palette";
import { seasonOf } from "@/lib/season";
import type { DestinationKind, TripList } from "@/lib/tripSchema";
import { getTowns, summaryFromList } from "@/lib/trips";
import { haversineM } from "@/lib/geo";
import { useTripSettings } from "@/lib/tripSettings";
import { useTownDrives } from "@/lib/useDriveRoute";
import { useUserLocation } from "@/lib/userLocation";
import { FilterChips, KidsSwitch } from "@/components/FilterChips";
import { SeasonScene } from "@/components/SeasonScene";
import { PullSky, SunPull } from "@/components/SunPull";
import { UiIcon } from "@/components/UiIcon";
import { SavedTripsLink } from "@/components/SavedTripsLink";
import { SiteFooter } from "@/components/SiteFooter";
import { StartChip } from "@/components/StartChip";
import { TripCard } from "@/components/TripCard";
import type { TripCardItem } from "@/components/TripCard";
import { BrowseMap } from "@/components/BrowseMap";
import type { BrowseArea, BrowseTrip, MapFocus, MapView } from "@/components/BrowseMap";

interface Props {
  /** The best known trips, rendered with the page; every trip loads after it. */
  trails: TrailDetail[];
}

/** Cards shown at first, and added by each "Ukázať ďalšie". */
const PAGE = 30;

const DESKTOP_QUERY = "(min-width: 1024px)";

/** Goal filters, most common first. */
const GOAL_FILTERS: DestinationKind[] = ["vrchol", "vodopad", "pleso", "hrad", "jaskyna", "vyhliadka", "chata"];
const DIFFICULTIES: Difficulty[] = ["lahka", "stredna", "tazka"];

/** Starts further than this from the nearest precomputed town get "~" on their drive times. */
const TOWN_EXACT_KM = 10;

/** The list shows the trips on the map plus this share of its size around it. */
const LIST_MARGIN = 0.3;

/** Trips outside the named mountain ranges: they join the closest area. */
const OTHER_REGION = "Ďalšie";

/** Phones: room kept free at the bottom of the map for the trip preview. */
const SHEET_INSET = 230;

type Box = [number, number, number, number];
type Preview =
  | { kind: "trip"; slug: string; also: string[]; x: number; y: number; peek: boolean }
  | { kind: "trail"; nearby: { slug: string; km: number }[]; x: number; y: number };

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True at Tailwind `lg:` and up; false on the server. Used to mount exactly one map. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  );
}

/** Every trip from public/data/trips/list.json, best known first; `initial` until it has loaded. */
function useAllTrails(initial: TrailDetail[]): TrailDetail[] {
  const [all, setAll] = useState<TrailDetail[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/data/trips/list.json")
      .then((r) => (r.ok ? (r.json() as Promise<TripList>) : null))
      .then((list) => {
        if (cancelled || !list) return;
        const trips = list.trips.map(summaryFromList).sort((a, b) => b.rank - a.rank);
        setAll(trips.map(trailDetailFrom));
      })
      .catch(() => {
        // Offline: the trips rendered with the page are still there.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return all ?? initial;
}

/** Lower case without accents, for search: "velka fatra" finds "Veľká Fatra". */
const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const goalOf = (d: TrailDetail): LatLng | null => d.trail.goal_location ?? primaryTrailhead(d)?.location ?? null;

function inBox(p: LatLng | null, [w, s, e, n]: Box): boolean {
  return p !== null && p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n;
}

function grow([w, s, e, n]: Box, k: number): Box {
  const dx = (e - w) * k;
  const dy = (n - s) * k;
  return [w - dx, s - dy, e + dx, n + dy];
}

/** One dot per mountain range for the zoomed-out map; trips outside the ranges join the closest. */
function areasOf(trails: TrailDetail[]): BrowseArea[] {
  const groups = new Map<string, { pts: LatLng[]; box: Box }>();
  const loose: LatLng[] = [];
  for (const d of trails) {
    const at = goalOf(d);
    const region = d.trail.region_name;
    if (!at || !region) continue;
    if (region.startsWith(OTHER_REGION)) {
      loose.push(at);
      continue;
    }
    // The zoom box covers whole trails, not just their goals, so a tap shows every trail of the area.
    const b = d.trail.bbox;
    const tb: Box = b ? [b.sw.lon, b.sw.lat, b.ne.lon, b.ne.lat] : [at.lon, at.lat, at.lon, at.lat];
    const g = groups.get(region);
    if (!g) groups.set(region, { pts: [at], box: tb });
    else {
      g.pts.push(at);
      g.box = [Math.min(g.box[0], tb[0]), Math.min(g.box[1], tb[1]), Math.max(g.box[2], tb[2]), Math.max(g.box[3], tb[3])];
    }
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const areas = [...groups].map(([name, { pts, box }]) => ({
    name,
    short: name.split(/,| a /)[0].trim(),
    location: { lat: median(pts.map((p) => p.lat)), lon: median(pts.map((p) => p.lon)) },
    n: pts.length,
    bbox: box,
  }));
  // Trips outside the named areas count toward the nearest one (for its size), without stretching its box.
  for (const p of loose) {
    let best = areas[0];
    let bestD = Infinity;
    for (const a of areas) {
      const d = (a.location.lat - p.lat) ** 2 + (a.location.lon - p.lon) ** 2;
      if (d < bestD) [best, bestD] = [a, d];
    }
    if (best) best.n++;
  }
  // Biggest first: when labels would overlap, the bigger area keeps its name.
  return areas.sort((a, b) => b.n - a.n).map(({ name, short, location, bbox }) => ({ name, short, location, bbox }));
}

/** The area outlines (pipeline/areas.py): they split Slovakia and give each area its dot and zoom box. */
function useAreaOutlines(): GeoJSON.FeatureCollection | null {
  const [outlines, setOutlines] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/data/map/areas.json", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((fc) => fc && setOutlines(fc))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  return outlines;
}

function areasFrom(outlines: GeoJSON.FeatureCollection): BrowseArea[] {
  return outlines.features.map((f) => {
    const p = f.properties as { id: string; name: string; short: string; label: [number, number]; bbox: Box };
    return { id: p.id, name: p.name, short: p.short, location: { lon: p.label[0], lat: p.label[1] }, bbox: p.bbox };
  });
}

/** Where the home map was when the visitor left the page. */
let lastView: MapView | null = null;

/**
 * "Kam dnes" home, map first: every trip on one map (coloured lines over the
 * grey trail network), with search, a filter menu, and a list that follows the
 * map, nearest first. Picking a day adds "Vyrazte najneskôr" and moves trips
 * that don't fit that day's daylight behind a button.
 */
export function HomeExplorer({ trails: initial }: Props) {
  const trails = useAllTrails(initial);
  const { date, today, withKids, travel, update } = useTripSettings();
  const [goalFilter, setGoalFilter] = useState<DestinationKind | null>(null);
  const [diffFilter, setDiffFilter] = useState<Difficulty[]>([]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const transit = travel === "transit";
  const { start } = useUserLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [pointed, setPointed] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Phones: the map is a card in the page; "Celá mapa" opens it full screen.
  const [fullMap, setFullMap] = useState(false);
  const mapCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fullMap) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullMap]);
  const showMapCard = useCallback(() => mapCardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), []);
  // Back on the home page the map opens where it was left (kept for this visit, not stored).
  const [mapView, setMapView] = useState<MapView | null>(() => lastView);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const columnRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const pickedRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();
  const focusKey = useRef(0);
  const moveMap = useCallback((f: Omit<Extract<MapFocus, { kind: "box" }>, "key"> | Omit<Extract<MapFocus, { kind: "point" }>, "key">) => {
    focusKey.current += 1;
    setFocus({ ...f, key: focusKey.current } as MapFocus);
  }, []);

  // Drive time to every trail from the weekly precomputed table, via the town nearest the start.
  const destinations = useMemo(() => trails.map((t) => driveDestination(t)), [trails]);
  // Drive times are shown by train/bus too (muted), so the two can be compared.
  const { drives, status: driveStatus } = useTownDrives(start);

  const { shown, hidden, noneFit } = useMemo(() => {
    const now = new Date();
    // Getting from the start to its table town: added on top, and "~" when that is a long way.
    const town: LatLng | null = drives ? { lat: drives.town.lat, lon: drives.town.lon } : null;
    const toTownKm = start && town ? haversineM(start, town) / 1000 : null;
    const accessMin = start && town && toTownKm! > 2 ? estimateDriveMin(start, town) : 0;
    const all = trails.flatMap((detail, i): TripCardItem[] => {
      const dest = destinations[i];
      const stop = nearestStop(detail);
      const table = drives?.minutes[detail.trail.slug] ?? null;
      if (withKids && !detail.trail.family_friendly) return [];
      if (goalFilter && (detail.trail.goal ?? "ine") !== goalFilter) return [];
      if (diffFilter.length > 0 && !diffFilter.includes(detail.trail.difficulty)) return [];
      // Table missing (offline, or a trip newer than the table): a straight-line estimate beats a blank, marked with "~".
      const estimate = table === null && driveStatus !== "loading" && start !== null && dest !== null;
      const viaTown = table !== null ? table + accessMin : null;
      // Far from the table town (e.g. Ždiar -> Belianska jaskyňa), the straight-line guess can be much closer.
      const direct = viaTown !== null && toTownKm! > TOWN_EXACT_KM && dest ? estimateDriveMin(start!, dest) : null;
      const carMin =
        viaTown !== null ? Math.min(viaTown, direct ?? Infinity) : estimate ? estimateDriveMin(start!, dest!) : null;
      const approx = estimate || (viaTown !== null && toTownKm! > TOWN_EXACT_KM);
      // By bus or train: an estimate from the road time (no timetables yet), so the day still counts the ride.
      const driveMin = transit ? (carMin !== null && stop ? transitMinutes(carMin) : null) : carMin;
      // The walk from the parking (by car) or the stop (by train/bus) to the trail and back is part of the day.
      const approach = transit ? (stop ? 2 * approachMin(stop.distance_m) : 0) : driveMin !== null ? 2 * defaultApproachMin(detail) : 0;
      const hikeMin = hikeMinutes(detail.trail.duration_min + approach, withKids);
      const th = primaryTrailhead(detail);
      const sun = sunLocation(detail);
      return [
        {
          detail,
          hikeMin,
          driveMin,
          carMin,
          driveApprox: approx,
          driveLoading: driveStatus === "loading",
          distanceM: start && th ? haversineM(start, th.location) : null,
          fit: date && today && sun ? dayFit({ date, now, driveMin, hikeMin, location: sun }) : null,
          closed: date !== null && activeClosures(detail.closures, date).length > 0,
          stop: transit ? stop : null,
          nearStop: stop,
          noStop: transit && !stop,
        },
      ];
    });
    if (start) {
      const key = (i: TripCardItem) => i.carMin ?? (i.distanceM ?? Infinity) / 1000;
      all.sort((a, b) => key(a) - key(b));
    }
    const open = all.filter((i) => !i.closed && !i.noStop);
    const fitting = open.filter((i) => !i.fit || i.fit.status === "fits");
    // Nothing fits the day (late evening): list every trip, each card says why, rather than an empty page.
    const noneFit = fitting.length === 0 && open.length > 0;
    const listed = new Set(noneFit ? open : fitting);
    return { shown: [...listed], hidden: all.filter((i) => !listed.has(i)), noneFit };
  }, [trails, destinations, drives, driveStatus, withKids, goalFilter, diffFilter, date, today, start, transit]);

  const listedAll = useMemo(() => (showHidden ? [...shown, ...hidden] : shown), [showHidden, shown, hidden]);
  const bySlug = useMemo(() => new Map(listedAll.map((i) => [i.detail.trail.slug, i])), [listedAll]);

  // The list: what the search finds anywhere, else the trips on the map and a little around it.
  const words = useMemo(() => plain(query).split(/\s+/).filter(Boolean), [query]);
  const matches = useCallback(
    (d: TrailDetail) => {
      const key = plain(`${d.trail.name} ${d.trail.region_name ?? ""}`);
      return words.every((w) => key.includes(w));
    },
    [words]
  );
  const scoped = useMemo(() => {
    if (words.length > 0) return listedAll.filter((i) => matches(i.detail));
    if (!mapView || mapView.zoom < mapView.areaZoom - 1) return listedAll;
    const box = grow(mapView.bounds, LIST_MARGIN);
    return listedAll.filter((i) => inBox(goalOf(i.detail), box));
  }, [listedAll, words, matches, mapView]);

  // Cards come in pages; a new filter or another part of the map starts again from the first page.
  const filterKey = [goalFilter, diffFilter.join(), withKids, date, travel, query].join("|");
  const [paging, setPaging] = useState({ key: filterKey, n: PAGE });
  const limit = paging.key === filterKey ? paging.n : PAGE;
  const visible = useMemo(() => {
    const page = scoped.slice(0, limit);
    // A trip picked on the map is always in the list, first if it would not be shown.
    const picked = selected ? bySlug.get(selected) : undefined;
    return picked && !page.includes(picked) ? [picked, ...page] : page;
  }, [scoped, limit, selected, bySlug]);

  const season = seasonOf(date ? new Date(`${date}T12:00`) : new Date());
  const dayWord = date && today ? dayInSentence(date, new Date()) : null;

  // The map: every trip that passes the filters.
  const mapTrips = useMemo<BrowseTrip[]>(
    () =>
      listedAll.flatMap(({ detail }) => {
        const at = goalOf(detail);
        const th = primaryTrailhead(detail);
        if (!at) return [];
        return [{ slug: detail.trail.slug, goal: detail.trail.goal ?? "ine", rank: detail.trail.rank ?? 0, location: at, start: th?.location ?? at }];
      }),
    [listedAll]
  );
  const outlines = useAreaOutlines();
  // Until the outlines arrive (or if they can't), the dots come from the trips themselves.
  const areas = useMemo(() => (outlines ? areasFrom(outlines) : areasOf(trails)), [outlines, trails]);

  const registerItem = useCallback((slug: string, el: HTMLElement | null) => {
    if (el) itemRefs.current.set(slug, el);
    else itemRefs.current.delete(slug);
  }, []);

  const tripBox = useCallback((d: TrailDetail): Box | null => {
    const b = d.trail.bbox;
    return b ? [b.sw.lon, b.sw.lat, b.ne.lon, b.ne.lat] : null;
  }, []);

  /** Pick a trip: on a phone its preview opens; on a computer the line and its card light up. */
  const pickTrip = useCallback(
    (slug: string | null, also: string[] = [], at = { x: 0, y: 0 }) => {
      setSelected(slug);
      if (!slug) {
        setPreview(null);
        return;
      }
      if (isDesktop) {
        setPreview(null);
        requestAnimationFrame(() => pickedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
      } else {
        setPreview({ kind: "trip", slug, also, ...at, peek: false });
      }
    },
    [isDesktop]
  );

  const goToTrip = useCallback(
    (slug: string) => {
      const item = bySlug.get(slug);
      const box = item ? tripBox(item.detail) : null;
      if (!isDesktop) showMapCard();
      if (box) moveMap({ kind: "box", bbox: box, maxZoom: 13 });
      pickTrip(slug);
    },
    [bySlug, tripBox, isDesktop, moveMap, pickTrip, showMapCard]
  );

  // ---- search: trips, mountain ranges, towns
  const towns = useMemo(() => getTowns(), []);
  const results = useMemo(() => {
    if (words.length === 0) return null;
    const has = (s: string) => words.every((w) => plain(s).includes(w));
    const first = (s: string) => plain(s).startsWith(words[0]) || plain(s).includes(` ${words[0]}`);
    const ranges = areas.filter((a) => has(a.name)).slice(0, 3);
    const trips = listedAll
      .filter((i) => matches(i.detail))
      .sort((a, b) => Number(first(b.detail.trail.name)) - Number(first(a.detail.trail.name)) || (b.detail.trail.rank ?? 0) - (a.detail.trail.rank ?? 0))
      .slice(0, 6);
    const places = towns.filter((t) => has(t.name)).slice(0, 3);
    return { ranges, trips, places };
  }, [words, areas, listedAll, matches, towns]);

  const closeMenus = useCallback(() => {
    setSearchOpen(false);
    setFiltersOpen(false);
  }, []);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!toolsRef.current?.contains(e.target as Node)) closeMenus();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [closeMenus]);

  const showOnMap = (focusTo: Parameters<typeof moveMap>[0]) => {
    setQuery("");
    closeMenus();
    setPreview(null);
    if (!isDesktop) showMapCard();
    moveMap(focusTo);
  };

  const filterCount = (goalFilter ? 1 : 0) + diffFilter.length;

  const heading = words.length > 0
    ? `Výsledky pre „${query.trim()}“`
    : dayWord && !noneFit
      ? `Stihnete ${dayWord}${start ? ", najbližšie prvé" : ""}`
      : start
        ? "Najbližšie výlety"
        : "Tisíce výletov po celom Slovensku";
  const scopeNote = words.length === 0 && mapView && mapView.zoom >= mapView.areaZoom - 1 ? "Na mape a kúsok okolo." : null;

  const pickedItem = isDesktop && selected ? bySlug.get(selected) : undefined;

  const cardList = (items: TripCardItem[]) =>
    items.map((item) => (
      <TripCard
        key={item.detail.trail.id}
        item={item}
        dayWord={dayWord}
        transit={transit}
        active={isDesktop && selected === item.detail.trail.slug}
        onActive={setPointed}
        registerItem={registerItem}
      />
    ));

  const previewTrip = preview?.kind === "trip" ? bySlug.get(preview.slug) : undefined;
  const sheet = preview && !isDesktop && (preview.kind === "trail" || previewTrip) && (
    <div role="dialog" aria-label="Náhľad výletu" className="absolute inset-x-0 bottom-0 z-10 flex max-h-[70%] flex-col gap-3 overflow-y-auto rounded-t-[20px] border border-[var(--border)] bg-[var(--card-bg)] p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[var(--shadow-float)]">
      <div className="flex items-center justify-between gap-3">
        <span className="mx-auto -mt-1 h-1 w-10 rounded-full bg-[var(--border)]" aria-hidden />
      </div>
      {previewTrip ? (
        <>
          <MiniCard item={previewTrip} />
          <Link
            href={`/trasa/${previewTrip.detail.trail.slug}`}
            className="rounded-full bg-[var(--accent)] px-4 py-3 text-center text-[15px] font-bold text-[var(--accent-contrast)]"
          >
            Vybrať tento výlet
          </Link>
          {preview.kind === "trip" && preview.also.length > 0 && (
            <OtherTrips title="Týmto miestom vedú aj" items={preview.also.flatMap((s) => (bySlug.get(s) ? [{ item: bySlug.get(s)!, note: null }] : []))} onPick={goToTrip} />
          )}
        </>
      ) : (
        preview.kind === "trail" && (
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--segment-bg)] text-[var(--muted)]" aria-hidden>
                <UiIcon name="boot" size={22} />
              </span>
              <div>
                <h3 className="text-lg leading-tight font-bold">Značený chodník</h3>
                <p className="text-sm text-[var(--muted)]">Tento kúsok zatiaľ nie je v žiadnom našom výlete.</p>
              </div>
            </div>
            <OtherTrips
              title={preview.nearby.length ? "Výlety v okolí" : "V okolí zatiaľ nemáme výlet."}
              items={preview.nearby.flatMap((n) => (bySlug.get(n.slug) ? [{ item: bySlug.get(n.slug)!, note: `${n.km.toFixed(1).replace(".", ",")} km odtiaľto` }] : []))}
              onPick={goToTrip}
            />
          </>
        )
      )}
      <button type="button" onClick={() => pickTrip(null)} aria-label="Zavrieť" className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-[var(--segment-bg)]">
        <UiIcon name="close" size={14} />
      </button>
    </div>
  );

  // Computer: a small card next to the pointer (hover), or the "no trip here" card next to a clicked grey trail,
  // kept inside the map near its right and bottom edges.
  const peekTrip = isDesktop && preview?.kind === "trip" && preview.peek ? previewTrip : undefined;
  const popover = isDesktop && preview && (peekTrip || preview.kind === "trail") && (
    <div
      className={`absolute z-10 w-[300px] rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-3 shadow-[var(--shadow-float)] ${peekTrip ? "pointer-events-none" : ""}`}
      style={{ left: `min(${preview.x + 18}px, calc(100% - 308px))`, top: `max(8px, min(${preview.y - 60}px, calc(100% - ${peekTrip ? 110 : 300}px)))` }}
    >
      {peekTrip ? (
        <MiniCard item={peekTrip} />
      ) : (
        preview.kind === "trail" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">Značený chodník</h3>
                <p className="text-sm text-[var(--muted)]">Tento kúsok zatiaľ nie je v žiadnom našom výlete.</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} aria-label="Zavrieť" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--segment-bg)]">
                <UiIcon name="close" size={12} />
              </button>
            </div>
            <OtherTrips
              title={preview.nearby.length ? "Výlety v okolí" : "V okolí zatiaľ nemáme výlet."}
              items={preview.nearby.flatMap((n) => (bySlug.get(n.slug) ? [{ item: bySlug.get(n.slug)!, note: `${n.km.toFixed(1).replace(".", ",")} km odtiaľto` }] : []))}
              onPick={goToTrip}
            />
          </div>
        )
      )}
    </div>
  );

  const map = (
    <div className="relative h-full w-full">
      <BrowseMap
        trips={mapTrips}
        areas={areas}
        outlines={outlines}
        selected={selected}
        highlighted={pointed}
        focus={focus}
        initialView={mapView}
        onView={(v) => {
          lastView = v;
          setMapView(v);
        }}
        onPick={(p) => (p ? pickTrip(p.slug, p.also, p) : pickTrip(null))}
        onHover={(h) => {
          setPointed(h?.slug ?? null);
          if (selected) return;
          setPreview((prev) => (h ? { kind: "trip", slug: h.slug, also: [], x: h.x, y: h.y, peek: true } : prev?.kind === "trip" && prev.peek ? null : prev));
        }}
        onTrailTap={(t) => {
          setSelected(null);
          setPreview({ kind: "trail", ...t });
        }}
        bottomInset={isDesktop ? 0 : SHEET_INSET}
        ariaLabel="Mapa všetkých výletov"
      />
      <div className="pointer-events-none absolute top-3 left-3 z-[5] flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-2.5 py-1.5 text-[11px] text-[var(--muted)] shadow-[var(--shadow-float)]" aria-hidden>
        <span className="flex items-center gap-1.5">
          málo chodené <i className="block h-1.5 w-12 rounded-full bg-[linear-gradient(90deg,#f7d54a,#f3a12f,#e8682a,#d9481f,#c8261b)]" /> obľúbené
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block h-[3px] w-5 rounded-full bg-[#8a8f7a] opacity-60" /> chodník bez výletu
        </span>
      </div>
      {sheet}
      {popover}
    </div>
  );

  const tools = (
    <div ref={toolsRef} className="relative flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Hľadať výlet, pohorie alebo obec</span>
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--muted)]">
            <UiIcon name="search" size={18} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
              setFiltersOpen(false);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchOpen(false);
              if (e.key === "Enter" && results) {
                const r = results.ranges[0];
                const t = results.trips[0];
                if (t) {
                  setQuery("");
                  closeMenus();
                  goToTrip(t.detail.trail.slug);
                } else if (r) showOnMap({ kind: "box", bbox: r.bbox, maxZoom: 11 });
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Hľadať výlet, pohorie alebo obec"
            autoComplete="off"
            className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--card-bg)] pr-3 pl-10 text-[15px] shadow-[var(--shadow-float)] lg:shadow-none"
          />
        </label>
        <button
          type="button"
          aria-expanded={filtersOpen}
          onClick={() => {
            setFiltersOpen((v) => !v);
            setSearchOpen(false);
          }}
          className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold shadow-[var(--shadow-float)] lg:shadow-none ${
            filterCount ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--card-bg)]"
          }`}
        >
          <UiIcon name="filter" size={16} />
          {filterCount ? `Filtre · ${filterCount}` : "Filtre"}
        </button>
      </div>


      {searchOpen && results && (
        <div role="listbox" aria-label="Výsledky hľadania" className="absolute top-12 right-0 left-0 z-30 max-h-[60vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-2 shadow-[var(--shadow-float)]">
          {results.ranges.length > 0 && <MenuTitle>Pohoria</MenuTitle>}
          {results.ranges.map((a) => (
            <MenuRow key={a.name} onClick={() => showOnMap({ kind: "box", bbox: a.bbox, maxZoom: 11 })} icon={<UiIcon name="up" size={16} />} title={a.name} note="Ukázať výlety v pohorí na mape" />
          ))}
          {results.trips.length > 0 && <MenuTitle>Výlety</MenuTitle>}
          {results.trips.map(({ detail }) => (
            <MenuRow
              key={detail.trail.slug}
              onClick={() => {
                setQuery("");
                closeMenus();
                goToTrip(detail.trail.slug);
              }}
              icon={<GoalTile goal={detail.trail.goal ?? "ine"} size={28} />}
              title={detail.trail.name}
              note={`${GOAL_LABEL[detail.trail.goal ?? "ine"]} · ${detail.trail.region_name ?? ""} · ${formatDurationShort(detail.trail.duration_min)}`}
            />
          ))}
          {results.places.length > 0 && <MenuTitle>Obce a mestá</MenuTitle>}
          {results.places.map((t) => (
            <MenuRow key={t.id} onClick={() => showOnMap({ kind: "point", location: t.location, zoom: 10.5 })} icon={<UiIcon name="pin" size={16} />} title={t.name} note="Ukázať výlety okolo na mape" />
          ))}
          {results.ranges.length + results.trips.length + results.places.length === 0 && (
            <p className="p-2 text-sm text-[var(--muted)]">Nič sa nenašlo. Skúste názov vrchu, chaty, pohoria alebo obce.</p>
          )}
        </div>
      )}

      {filtersOpen && (
        <div className="absolute top-12 right-0 left-0 z-30 max-h-[70vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-2 shadow-[var(--shadow-float)]">
          <MenuTitle>Cieľ</MenuTitle>
          <div className="grid grid-cols-2">
            {[null, ...GOAL_FILTERS].map((g) => (
              <label key={g ?? "all"} className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-[15px] hover:bg-[var(--segment-bg)]">
                <input type="radio" name="goal" checked={goalFilter === g} onChange={() => setGoalFilter(g)} className="h-[18px] w-[18px] accent-[var(--accent)]" />
                {g && <span className="h-3 w-3 rounded-[3px]" style={{ background: GOAL_COLOUR[g] }} />}
                {g ? GOAL_PLURAL[g] : "Všetky ciele"}
              </label>
            ))}
          </div>
          <MenuTitle>Náročnosť</MenuTitle>
          <div className="grid grid-cols-2">
            {DIFFICULTIES.map((d) => (
              <label key={d} className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-[15px] hover:bg-[var(--segment-bg)]">
                <input
                  type="checkbox"
                  checked={diffFilter.includes(d)}
                  onChange={(e) => setDiffFilter((prev) => (e.target.checked ? [...prev, d] : prev.filter((x) => x !== d)))}
                  className="h-[18px] w-[18px] accent-[var(--accent)]"
                />
                {DIFFICULTY_LABEL[d]}
              </label>
            ))}
          </div>
          <div className="sticky -bottom-2 mt-1 -mb-2 flex justify-between gap-2 border-t border-[var(--border)] bg-[var(--card-bg)] p-2">
            <button
              type="button"
              onClick={() => {
                setGoalFilter(null);
                setDiffFilter([]);
              }}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
            >
              Zrušiť filtre
            </button>
            <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--accent-contrast)]">
              Hotovo
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const showTomorrow = () => {
    const t = new Date();
    update({ date: isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) });
  };

  const list = (
    <section className="flex flex-col gap-3" aria-live="polite">
      <div className="flex flex-col">
        <h2 className="text-base font-bold">{heading}</h2>
        {scopeNote && <p className="text-[13px] text-[var(--muted)]">{scopeNote}</p>}
      </div>

      {noneFit && dayWord && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-card)] bg-[var(--warn-bg)] p-3 text-sm text-[var(--warn)]">
          <p className="font-semibold">{dayWord === "dnes" ? "Dnes" : "Vtedy"} už za svetla nič nestihnete. Ukazujeme všetky výlety.</p>
          {dayWord === "dnes" && (
            <button type="button" onClick={showTomorrow} className="font-semibold underline">
              Pozrieť zajtra
            </button>
          )}
        </div>
      )}

      {visible.length === 0 && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--border)] p-4 text-sm">
          <p>
            {shown.length === 0
              ? dayWord
                ? `${dayWord === "dnes" ? "Dnes" : "Vtedy"} s týmito filtrami nič nestihnete.`
                : "S týmito filtrami nič nenachádzame."
              : "Tu nič nie je. Posuňte mapu alebo hľadajte inde."}
          </p>
          <div className="flex flex-wrap gap-3">
            {filterCount > 0 && (
              <button type="button" onClick={() => { setGoalFilter(null); setDiffFilter([]); }} className="font-semibold text-[var(--accent)] underline">
                Zrušiť filtre
              </button>
            )}
            {withKids && (
              <button type="button" onClick={() => update({ withKids: false })} className="font-semibold text-[var(--accent)] underline">
                Zrušiť s deťmi
              </button>
            )}
            {dayWord === "dnes" && (
              <button type="button" onClick={showTomorrow} className="font-semibold text-[var(--accent)] underline">
                Pozrieť zajtra
              </button>
            )}
          </div>
        </div>
      )}

      {pickedItem && (
        // Picked on the map: a bigger card that stays on top while the list scrolls under it.
        <div ref={pickedRef} className="sticky top-0 z-10 -mx-1 bg-[var(--background)] px-1 pt-1 pb-2">
          <TripCard
            item={pickedItem}
            dayWord={dayWord}
            transit={transit}
            active
            onClose={() => pickTrip(null)}
            onActive={setPointed}
            registerItem={registerItem}
          />
        </div>
      )}

      {cardList(pickedItem ? visible.filter((i) => i !== pickedItem) : visible)}

      {scoped.length > limit && (
        <button
          type="button"
          onClick={() => setPaging({ key: filterKey, n: limit + PAGE })}
          className="w-fit self-center rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--accent)]"
        >
          Ukázať ďalšie
        </button>
      )}

      {hidden.length > 0 && !showHidden && limit >= scoped.length && (
        <button type="button" onClick={() => setShowHidden(true)} className="w-fit text-sm font-semibold text-[var(--accent)] underline">
          {dayWord ? `Ukázať aj tie, čo ${dayWord} nestihnete` : "Ukázať aj výlety bez zastávky"}
        </button>
      )}
    </section>
  );

  return (
    <main className="flex flex-1 flex-col lg:h-dvh lg:flex-none lg:flex-row lg:overflow-hidden">
      <div ref={columnRef} className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-4 pb-6 lg:mx-0 lg:w-[440px] lg:max-w-none lg:shrink-0 relative lg:overflow-y-auto lg:overscroll-contain">
        <PullSky season={season} />
        <header className="relative -mx-4 -mt-4 flex shrink-0 flex-col sm:overflow-hidden sm:rounded-b-[24px] lg:overflow-visible lg:rounded-none">
          <SeasonScene season={season} width={440} height={250} seed={11} sunX={0.64} sunY={0.17} drop={0.2} noSun className="absolute inset-0 h-full w-full" />
          <SunPull season={season} width={440} height={250} sunX={0.64} sunY={0.17} moveRef={columnRef} />
          <nav aria-label="Hlavná navigácia" className="relative flex items-center justify-between gap-3 px-4 pt-4">
            <Link href="/" aria-label="MounTour" className="block">
              {/* The hero sky is light in both themes, so the dark-ink logo always. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/mountour-logo.svg" alt="MounTour" width={150} height={23} className="h-[23px] w-auto" />
            </Link>
            <SavedTripsLink />
          </nav>
          <div className="relative flex flex-col gap-2 px-4 pt-6 pb-16 text-[#14233b]">
            <h1 className="text-[2.15rem] leading-none font-extrabold tracking-tight">Kam dnes?</h1>
            <p className="max-w-[30ch] text-[15px] font-medium">Výlety, z ktorých budete späť za svetla.</p>
          </div>
        </header>

        <div className="relative z-[1] -mx-1 -mt-14">
          <StartChip />
        </div>

        <div className="-mx-1 flex flex-col gap-3 rounded-[18px] bg-[var(--card-bg)] p-3 shadow-[var(--shadow-float)]">
          <FilterChips />
          <KidsSwitch />
        </div>

        {/* Search, filters and Mapa / Zoznam stay on top while the map fills the screen. */}
        <div className="sticky top-0 z-20 -mx-4 bg-[var(--background)] px-4 py-2 lg:static lg:mx-0 lg:bg-transparent lg:p-0">{tools}</div>

        {!isDesktop && (
          // A card with gutters: a thumb beside it still scrolls the page past the map.
          <div
            ref={mapCardRef}
            className={
              fullMap
                ? "fixed inset-0 z-50 bg-[var(--background)] pt-[env(safe-area-inset-top)]"
                : "relative h-[58vh] max-h-[560px] min-h-[340px] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]"
            }
          >
            {map}
            <button
              type="button"
              onClick={() => setFullMap((v) => !v)}
              className="absolute top-2.5 right-2.5 z-[6] inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-3.5 text-sm font-bold shadow-[var(--shadow-float)]"
              style={fullMap ? { top: "calc(10px + env(safe-area-inset-top))" } : undefined}
            >
              {fullMap ? <UiIcon name="close" size={13} /> : <UiIcon name="map" size={16} />}
              {fullMap ? "Zavrieť mapu" : "Celá mapa"}
            </button>
          </div>
        )}

        {list}

        <SiteFooter />
      </div>

      {isDesktop && <div className="sticky top-0 h-dvh flex-1 border-l border-[var(--border)]">{map}</div>}
    </main>
  );
}

function GoalTile({ goal, size }: { goal: DestinationKind; size: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-lg text-white"
      style={{ background: GOAL_COLOUR[goal], width: size, height: size }}
      // Constant markup from lib/kindIcons.ts, no user data.
      dangerouslySetInnerHTML={{ __html: kindSvg(goal, Math.round(size * 0.62)) }}
    />
  );
}

function MenuTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mx-2 mt-2 mb-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">{children}</h4>;
}

function MenuRow({ icon, title, note, onClick }: { icon: React.ReactNode; title: string; note: string; onClick: () => void }) {
  return (
    <button type="button" role="option" aria-selected={false} onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-[var(--segment-bg)]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--segment-bg)] text-[var(--muted)]">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{title}</span>
        <span className="block truncate text-xs text-[var(--muted)]">{note}</span>
      </span>
    </button>
  );
}

/** The trip in a preview: name, what and where, how long. */
function MiniCard({ item }: { item: TripCardItem }) {
  const { trail } = item.detail;
  const goal = trail.goal ?? "ine";
  const km = (trail.distance_m / 1000).toFixed(1).replace(".", ",");
  return (
    <div className="flex items-start gap-3 pr-8">
      <GoalTile goal={goal} size={44} />
      <div className="min-w-0">
        <h3 className="text-lg leading-tight font-bold">{trail.name}</h3>
        <p className="text-[13px] text-[var(--muted)]">
          {GOAL_LABEL[goal]}
          {trail.region_name ? ` · ${trail.region_name}` : ""}
        </p>
        <p className="font-data mt-1 flex flex-wrap gap-x-3 text-sm font-semibold">
          {item.carMin !== null && (
            <span className="inline-flex items-center gap-1">
              <UiIcon name="car" size={14} />
              {item.driveApprox ? "~" : ""}
              {formatDurationShort(item.carMin)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <UiIcon name="boot" size={14} />
            {formatDurationShort(item.hikeMin)}
          </span>
          <span>{km} km</span>
          <span>{DIFFICULTY_LABEL[trail.difficulty]}</span>
        </p>
      </div>
    </div>
  );
}

function OtherTrips({ title, items, onPick }: { title: string; items: { item: TripCardItem; note: string | null }[]; onPick: (slug: string) => void }) {
  return (
    <div className="border-t border-[var(--border)] pt-2">
      <p className="text-xs font-semibold text-[var(--muted)]">{title}</p>
      {items.map(({ item, note }) => {
        const { trail } = item.detail;
        return (
          <button key={trail.slug} type="button" onClick={() => onPick(trail.slug)} className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-[var(--segment-bg)]">
            <GoalTile goal={trail.goal ?? "ine"} size={28} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{trail.name}</span>
              <span className="block text-xs text-[var(--muted)]">
                {note ? `${note} · ` : ""}
                {formatDurationShort(item.hikeMin)} · {DIFFICULTY_LABEL[trail.difficulty]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
