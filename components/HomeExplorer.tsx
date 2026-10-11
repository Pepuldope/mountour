"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { BBox, LatLng, TrailDetail } from "@/lib/types";
import { defaultApproachMin, driveDestination, nearestStop, primaryTrailhead, sunLocation, trailDetailFrom } from "@/lib/data";
import { activeClosures } from "@/lib/closures";
import { approachMin, hikeMinutes } from "@/lib/dayPlan";
import { dayFit, dayInSentence, isoDate } from "@/lib/days";
import { estimateDriveMin } from "@/lib/drive";
import { GOAL_PLURAL, tripsCount } from "@/lib/format";
import { GOAL_COLOUR } from "@/lib/palette";
import { seasonOf } from "@/lib/season";
import type { DestinationKind, TripList } from "@/lib/tripSchema";
import { summaryFromList } from "@/lib/trips";
import { fetchTrack, gpxUrlFor } from "@/lib/gpx";
import { haversineM } from "@/lib/geo";
import { trackColor } from "@/lib/mapLayers";
import { useTripSettings } from "@/lib/tripSettings";
import { useTownDrives } from "@/lib/useDriveRoute";
import { useUserLocation } from "@/lib/userLocation";
import { FilterChips, KidsSwitch } from "@/components/FilterChips";
import { SeasonScene } from "@/components/SeasonScene";
import { UiIcon } from "@/components/UiIcon";
import { SavedTripsLink } from "@/components/SavedTripsLink";
import { SiteFooter } from "@/components/SiteFooter";
import { StartChip } from "@/components/StartChip";
import { NETWORK_ON } from "@/lib/trailNetwork";
import { TripCard } from "@/components/TripCard";
import type { TripCardItem } from "@/components/TripCard";
import { TrailMap } from "@/components/TrailMapClient";
import type { MapMarker, MapTrack } from "@/components/TrailMap";

interface Props {
  /** The best known trips, rendered with the page; every trip loads after it. */
  trails: TrailDetail[];
}

/** Cards shown at first, and added by each "Ukázať ďalšie". */
const PAGE = 30;

const DESKTOP_QUERY = "(min-width: 1024px)";

/** Goal filters on the list, most common first. */
const GOAL_FILTERS: DestinationKind[] = ["vrchol", "vodopad", "pleso", "hrad", "jaskyna", "vyhliadka", "chata"];

/** Starts further than this from the nearest precomputed town get "~" on their drive times. */
const TOWN_EXACT_KM = 10;

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

/** Union of every trail's bbox, so the overview map shows them all. */
function unionBounds(trails: TrailDetail[]): BBox | null {
  const boxes = trails.map((t) => t.trail.bbox).filter((b): b is BBox => b !== null);
  if (boxes.length === 0) return null;
  return {
    sw: { lat: Math.min(...boxes.map((b) => b.sw.lat)), lon: Math.min(...boxes.map((b) => b.sw.lon)) },
    ne: { lat: Math.max(...boxes.map((b) => b.ne.lat)), lon: Math.max(...boxes.map((b) => b.ne.lon)) },
  };
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

/**
 * "Kam dnes" home: answer first. Every trip is listed on arrival, sorted by
 * travel time once the start is known. Picking a day adds "Vyrazte najneskôr"
 * and moves trips that don't fit that day's daylight behind a button.
 */
export function HomeExplorer({ trails: initial }: Props) {
  const trails = useAllTrails(initial);
  const { date, today, withKids, travel, update } = useTripSettings();
  const [goalFilter, setGoalFilter] = useState<DestinationKind | null>(null);
  const transit = travel === "transit";
  const { start } = useUserLocation();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [showMapOnPhone, setShowMapOnPhone] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [trackPoints, setTrackPoints] = useState<Record<string, [number, number][]>>({});
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const isDesktop = useIsDesktop();
  const mapShown = isDesktop || showMapOnPhone;

  // With the trail network on, only the trip in focus is drawn, so only its GPX is fetched.
  const wanted = useMemo(
    () => (NETWORK_ON ? trails.filter(({ trail }) => trail.slug === activeSlug) : trails).map(({ trail }) => trail),
    [trails, activeSlug]
  );
  useEffect(() => {
    if (!mapShown) return;
    let cancelled = false;
    for (const trail of wanted) {
      const url = gpxUrlFor(trail.gpx_path);
      if (!url || trackPoints[trail.slug]) continue;
      fetchTrack(url).then((track) => {
        if (cancelled || track.length === 0) return;
        setTrackPoints((prev) => ({ ...prev, [trail.slug]: track.map((p) => [p.lat, p.lon]) }));
      });
    }
    return () => {
      cancelled = true;
    };
    // trackPoints is read to skip loaded tracks, not to refetch when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, mapShown]);

  // Drive time to every trail from the weekly precomputed table, via the town nearest the start.
  const destinations = useMemo(() => trails.map((t) => driveDestination(t)), [trails]);
  // Drive times are shown by train/bus too (muted), so the two can be compared.
  const { drives, status: driveStatus } = useTownDrives(start);

  const { shown, hidden } = useMemo(() => {
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
      // Table missing (offline, or a trip newer than the table): a straight-line estimate beats a blank, marked with "~".
      const estimate = table === null && driveStatus !== "loading" && start !== null && dest !== null;
      const viaTown = table !== null ? table + accessMin : null;
      // Far from the table town (e.g. Ždiar -> Belianska jaskyňa), the straight-line guess can be much closer.
      const direct = viaTown !== null && toTownKm! > TOWN_EXACT_KM && dest ? estimateDriveMin(start!, dest) : null;
      const carMin =
        viaTown !== null ? Math.min(viaTown, direct ?? Infinity) : estimate ? estimateDriveMin(start!, dest!) : null;
      const approx = estimate || (viaTown !== null && toTownKm! > TOWN_EXACT_KM);
      const driveMin = transit ? null : carMin;
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
    return {
      shown: all.filter((i) => !i.closed && !i.noStop && (!i.fit || i.fit.status === "fits")),
      hidden: all.filter((i) => i.closed || i.noStop || (i.fit && i.fit.status !== "fits")),
    };
  }, [trails, destinations, drives, driveStatus, withKids, goalFilter, date, today, start, transit]);

  // Cards come in pages; a new filter starts again from the first page.
  const filterKey = [goalFilter, withKids, date, travel].join("|");
  const [paging, setPaging] = useState({ key: filterKey, n: PAGE });
  const limit = paging.key === filterKey ? paging.n : PAGE;
  const listed = useMemo(() => (showHidden ? [...shown, ...hidden] : shown), [showHidden, shown, hidden]);
  const visible = useMemo(() => listed.slice(0, limit), [listed, limit]);

  const season = seasonOf(date ? new Date(`${date}T12:00`) : new Date());

  const shownSlugs = useMemo(() => new Set(shown.map((m) => m.detail.trail.slug)), [shown]);
  const dayWord = date && today ? dayInSentence(date, new Date()) : null;

  const tracks = useMemo<MapTrack[]>(
    () =>
      // The whole trail network is drawn underneath, coloured by popularity;
      // of our trips only the one in focus is drawn, in its painted KST colour.
      // (Until NETWORK_ON, every trip is drawn, dimmed when it doesn't fit.)
      trails
        .filter(({ trail }) => !NETWORK_ON || trail.slug === activeSlug)
        .map(({ trail }) => ({
          slug: trail.slug,
          label: trail.name,
          points: trackPoints[trail.slug] ?? [],
          color: trackColor(trail.marking),
          state: trail.slug === activeSlug ? "selected" : shownSlugs.has(trail.slug) ? "normal" : "dimmed",
        })),
    [trails, trackPoints, activeSlug, shownSlugs]
  );

  // Pins for the cards on the list only: a pin for each of thousands of trips would bury the map.
  const markers = useMemo<MapMarker[]>(
    () =>
      visible.flatMap(({ detail }) => {
        const th = primaryTrailhead(detail);
        if (!th) return [];
        return [
          {
            id: `th-${th.id}`,
            kind: "trailhead" as const,
            location: th.location,
            title: detail.trail.name,
            lines: [th.name],
            dimmed: !shownSlugs.has(detail.trail.slug),
            active: detail.trail.slug === activeSlug,
            trailSlug: detail.trail.slug,
            // Same goal colour as the card's tile; the active pin stays sun-yellow.
            colour: detail.trail.slug === activeSlug ? undefined : GOAL_COLOUR[detail.trail.goal ?? "ine"],
          },
        ];
      }),
    [visible, shownSlugs, activeSlug]
  );

  const bounds = useMemo(() => unionBounds(trails), [trails]);

  const registerItem = useCallback((slug: string, el: HTMLElement | null) => {
    if (el) itemRefs.current.set(slug, el);
    else itemRefs.current.delete(slug);
  }, []);

  const handleMapSelect = useCallback((slug: string) => {
    setActiveSlug(slug);
    itemRefs.current.get(slug)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const map = (
    <TrailMap
      tracks={tracks}
      markers={markers}
      bounds={bounds}
      onSelectTrail={handleMapSelect}
      network={NETWORK_ON ? "full" : undefined}
      ariaLabel="Mapa všetkých výletov"
    />
  );

  const heading = !dayWord
    ? `${tripsCount(shown.length)}${start ? ", najbližšie prvé" : ""}`
    : `${tripsCount(shown.length)} stihnete ${dayWord}`;

  const cardList = (items: TripCardItem[]) =>
    items.map((item) => (
      <TripCard
        key={item.detail.trail.id}
        item={item}
        dayWord={dayWord}
        transit={transit}
        active={isDesktop && activeSlug === item.detail.trail.slug}
        onActive={setActiveSlug}
        registerItem={registerItem}
      />
    ));

  return (
    <main className="flex flex-1 flex-col lg:h-dvh lg:flex-none lg:flex-row lg:overflow-hidden">
      <div className="flex w-full flex-col gap-5 px-4 pt-4 pb-6 lg:w-[440px] lg:shrink-0 relative lg:overflow-y-auto lg:overscroll-contain">
        <header className="relative -mx-4 -mt-4 flex flex-col">
          <SeasonScene season={season} width={440} height={250} seed={11} sunX={0.64} sunY={0.17} drop={0.2} className="absolute inset-0 h-full w-full" />
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
            <StartChip folded />
          </div>
        </header>

        <div className="relative z-[1] -mx-1 -mt-14 flex flex-col gap-3 rounded-[18px] bg-[var(--card-bg)] p-3 shadow-[var(--shadow-float)]">
          <FilterChips />
          <KidsSwitch />
        </div>

        <section className="flex flex-col gap-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold">{heading}</h2>
            {!isDesktop && (
              <button
                type="button"
                onClick={() => setShowMapOnPhone((v) => !v)}
                aria-expanded={showMapOnPhone}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]"
              >
                <UiIcon name="map" size={16} />
                {showMapOnPhone ? "Skryť mapu" : "Mapa"}
              </button>
            )}
          </div>

          <div role="group" aria-label="Druh cieľa" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
            {GOAL_FILTERS.map((g) => {
              const on = goalFilter === g;
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGoalFilter(on ? null : g)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                    on ? "border-transparent text-white" : "border-[var(--border)] bg-[var(--card-bg)]"
                  }`}
                  style={on ? { background: GOAL_COLOUR[g] } : undefined}
                >
                  {!on && <span className="h-[9px] w-[9px] rounded-full" style={{ background: GOAL_COLOUR[g] }} />}
                  {GOAL_PLURAL[g]}
                </button>
              );
            })}
          </div>

          {!isDesktop && showMapOnPhone && (
            <div className="h-[45vh] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
              {map}
            </div>
          )}

          {shown.length === 0 && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--border)] p-4 text-sm">
              <p>{dayWord ? `${dayWord === "dnes" ? "Dnes" : "Vtedy"} s týmito filtrami nič nestihnete.` : "S týmito filtrami nič nenachádzame."}</p>
              <div className="flex flex-wrap gap-3">
                {goalFilter && (
                  <button type="button" onClick={() => setGoalFilter(null)} className="font-semibold text-[var(--accent)] underline">
                    Ukázať všetky ciele
                  </button>
                )}
                {withKids && (
                  <button type="button" onClick={() => update({ withKids: false })} className="font-semibold text-[var(--accent)] underline">
                    Zrušiť s deťmi
                  </button>
                )}
                {dayWord === "dnes" && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = new Date();
                      update({ date: isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) });
                    }}
                    className="font-semibold text-[var(--accent)] underline"
                  >
                    Pozrieť zajtra
                  </button>
                )}
              </div>
            </div>
          )}

          {cardList(visible)}

          {listed.length > limit && (
            <button
              type="button"
              onClick={() => setPaging({ key: filterKey, n: limit + PAGE })}
              className="w-fit rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--accent)]"
            >
              Ukázať ďalšie ({listed.length - limit})
            </button>
          )}

          {hidden.length > 0 && !showHidden && limit >= shown.length && (
            <button
              type="button"
              onClick={() => {
                setShowHidden(true);
                setPaging({ key: filterKey, n: shown.length + PAGE });
              }}
              className="w-fit text-sm font-semibold text-[var(--accent)] underline"
            >
              {dayWord ? `Ukázať aj tie, čo ${dayWord} nestihnete` : "Ukázať aj výlety bez zastávky"} ({hidden.length})
            </button>
          )}
        </section>

        <SiteFooter />
      </div>

      {isDesktop && <div className="sticky top-0 h-dvh flex-1 border-l border-[var(--border)]">{map}</div>}
    </main>
  );
}
