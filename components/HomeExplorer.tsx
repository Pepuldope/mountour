"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { BBox, LatLng, TrailDetail } from "@/lib/types";
import { driveDestination, primaryTrailhead, sunLocation } from "@/lib/data";
import { activeClosures } from "@/lib/closures";
import { hikeMinutes } from "@/lib/dayPlan";
import { HALF_DAY_MIN, dayFit, dayInSentence, isoDate } from "@/lib/days";
import { estimateDriveMin } from "@/lib/drive";
import { tripsCount } from "@/lib/format";
import { fetchTrack, gpxUrlFor } from "@/lib/gpx";
import { haversineM } from "@/lib/geo";
import { trackColor } from "@/lib/mapLayers";
import { useTripSettings } from "@/lib/tripSettings";
import { useTownDrives } from "@/lib/useDriveRoute";
import { useUserLocation } from "@/lib/userLocation";
import { FilterChips } from "@/components/FilterChips";
import { SavedTripsLink } from "@/components/SavedTripsLink";
import { SiteFooter } from "@/components/SiteFooter";
import { StartChip } from "@/components/StartChip";
import { TripCard } from "@/components/TripCard";
import type { TripCardItem } from "@/components/TripCard";
import { TrailMap } from "@/components/TrailMapClient";
import type { MapMarker, MapTrack } from "@/components/TrailMap";

interface Props {
  trails: TrailDetail[];
}

const DESKTOP_QUERY = "(min-width: 1024px)";

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

/**
 * "Kam dnes" home: answer first. Every trip is listed on arrival, sorted by
 * travel time once the start is known. Picking a day adds "Vyrazte najneskôr"
 * and moves trips that don't fit that day's daylight behind a button.
 */
export function HomeExplorer({ trails }: Props) {
  const { date, today, withKids, halfDay, update } = useTripSettings();
  const { start } = useUserLocation();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [showMapOnPhone, setShowMapOnPhone] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [trackPoints, setTrackPoints] = useState<Record<string, [number, number][]>>({});
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const isDesktop = useIsDesktop();
  const mapShown = isDesktop || showMapOnPhone;

  // Tracks only matter once a map is on screen.
  useEffect(() => {
    if (!mapShown) return;
    let cancelled = false;
    for (const { trail } of trails) {
      const url = gpxUrlFor(trail.gpx_path);
      if (!url) continue;
      fetchTrack(url).then((track) => {
        if (cancelled || track.length === 0) return;
        setTrackPoints((prev) => ({ ...prev, [trail.slug]: track.map((p) => [p.lat, p.lon]) }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [trails, mapShown]);

  // Drive time to every trail from the weekly precomputed table, via the town nearest the start.
  const destinations = useMemo(() => trails.map((t) => driveDestination(t)), [trails]);
  const { drives, status: driveStatus } = useTownDrives(start);

  const { shown, hidden } = useMemo(() => {
    const now = new Date();
    // Getting from the start to its table town: added on top, and "~" when that is a long way.
    const town: LatLng | null = drives ? { lat: drives.town.lat, lon: drives.town.lon } : null;
    const toTownKm = start && town ? haversineM(start, town) / 1000 : null;
    const accessMin = start && town && toTownKm! > 2 ? estimateDriveMin(start, town) : 0;
    const all = trails.flatMap((detail, i): TripCardItem[] => {
      const dest = destinations[i];
      const table = drives?.minutes[detail.trail.slug] ?? null;
      if (withKids && !detail.trail.family_friendly) return [];
      // Table missing (offline, or a trip newer than the table): a straight-line estimate beats a blank, marked with "~".
      const estimate = table === null && driveStatus !== "loading" && start !== null && dest !== null;
      const viaTown = table !== null ? table + accessMin : null;
      // Far from the table town (e.g. Ždiar -> Belianska jaskyňa), the straight-line guess can be much closer.
      const direct = viaTown !== null && toTownKm! > TOWN_EXACT_KM && dest ? estimateDriveMin(start!, dest) : null;
      const driveMin =
        viaTown !== null ? Math.min(viaTown, direct ?? Infinity) : estimate ? estimateDriveMin(start!, dest!) : null;
      const approx = estimate || (viaTown !== null && toTownKm! > TOWN_EXACT_KM);
      const hikeMin = hikeMinutes(detail.trail.duration_min, withKids);
      if (halfDay && hikeMin + 2 * (driveMin ?? 0) > HALF_DAY_MIN) return [];
      const th = primaryTrailhead(detail);
      const sun = sunLocation(detail);
      return [
        {
          detail,
          hikeMin,
          driveMin,
          driveApprox: approx,
          driveLoading: driveStatus === "loading",
          distanceM: start && th ? haversineM(start, th.location) : null,
          fit: date && today && sun ? dayFit({ date, now, driveMin, hikeMin, location: sun }) : null,
          closed: date !== null && activeClosures(detail.closures, date).length > 0,
        },
      ];
    });
    if (start) {
      const key = (i: TripCardItem) => i.driveMin ?? (i.distanceM ?? Infinity) / 1000;
      all.sort((a, b) => key(a) - key(b));
    }
    return {
      shown: all.filter((i) => !i.closed && (!i.fit || i.fit.status === "fits")),
      hidden: all.filter((i) => i.closed || (i.fit && i.fit.status !== "fits")),
    };
  }, [trails, destinations, drives, driveStatus, withKids, halfDay, date, today, start]);

  const shownSlugs = useMemo(() => new Set(shown.map((m) => m.detail.trail.slug)), [shown]);
  const dayWord = date && today ? dayInSentence(date, new Date()) : null;

  const tracks = useMemo<MapTrack[]>(
    () =>
      trails.map(({ trail }) => ({
        slug: trail.slug,
        label: trail.name,
        points: trackPoints[trail.slug] ?? [],
        color: trackColor(trail.marking),
        state: trail.slug === activeSlug ? "selected" : shownSlugs.has(trail.slug) ? "normal" : "dimmed",
      })),
    [trails, trackPoints, activeSlug, shownSlugs]
  );

  const markers = useMemo<MapMarker[]>(
    () =>
      trails.flatMap((detail) => {
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
          },
        ];
      }),
    [trails, shownSlugs, activeSlug]
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
        active={isDesktop && activeSlug === item.detail.trail.slug}
        onActive={setActiveSlug}
        registerItem={registerItem}
      />
    ));

  return (
    <main className="flex flex-1 flex-col lg:h-dvh lg:flex-row">
      <div className="flex w-full flex-col gap-5 px-4 pt-4 pb-6 lg:w-[440px] lg:shrink-0 lg:overflow-y-auto">
        <nav aria-label="Hlavná navigácia" className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="MounTour" className="block">
            <picture>
              <source srcSet="/brand/mountour-logo-on-dark.svg" media="(prefers-color-scheme: dark)" />
              { }
              <img src="/brand/mountour-logo.svg" alt="MounTour" width={150} height={23} className="h-[23px] w-auto" />
            </picture>
          </Link>
          <SavedTripsLink />
        </nav>

        <header className="flex flex-col gap-3">
          <h1 className="text-[1.65rem] leading-tight font-extrabold">Kam dnes, aby ste boli späť za svetla?</h1>
          <StartChip />
          <FilterChips />
        </header>

        <section className="flex flex-col gap-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold">{heading}</h2>
            {!isDesktop && (
              <button
                type="button"
                onClick={() => setShowMapOnPhone((v) => !v)}
                aria-expanded={showMapOnPhone}
                className="text-sm font-semibold text-[var(--accent)] underline"
              >
                {showMapOnPhone ? "Skryť mapu" : "Mapa"}
              </button>
            )}
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
                {halfDay && (
                  <button type="button" onClick={() => update({ halfDay: false })} className="font-semibold text-[var(--accent)] underline">
                    Zrušiť pol dňa
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

          {cardList(shown)}

          {hidden.length > 0 && !showHidden && (
            <button
              type="button"
              onClick={() => setShowHidden(true)}
              className="w-fit text-sm font-semibold text-[var(--accent)] underline"
            >
              Ukázať aj tie, čo {dayWord} nestihnete ({hidden.length})
            </button>
          )}
          {showHidden && cardList(hidden)}
        </section>

        <SiteFooter />
      </div>

      {isDesktop && <div className="sticky top-0 h-dvh flex-1 border-l border-[var(--border)]">{map}</div>}
    </main>
  );
}
