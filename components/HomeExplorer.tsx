"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { BBox, LatLng, TrailDetail } from "@/lib/types";
import { driveDestination, filterTrails, primaryTrailhead, sunLocation } from "@/lib/data";
import { planDay } from "@/lib/dayPlan";
import { fetchTrack, gpxUrlFor } from "@/lib/gpx";
import { haversineM } from "@/lib/geo";
import { useTripSettings } from "@/lib/tripSettings";
import { useDriveMatrix, useDriveRoute } from "@/lib/useDriveRoute";
import { useUserLocation } from "@/lib/userLocation";
import { TrailPicker } from "@/components/TrailPicker";
import { TrailList } from "@/components/TrailList";
import type { TrailListItem } from "@/components/TrailList";
import { DayPlanView } from "@/components/DayPlanView";
import { SavedTripsLink } from "@/components/SavedTripsLink";
import { TrailMap } from "@/components/TrailMapClient";
import type { MapMarker, MapTrack } from "@/components/TrailMap";

interface Props {
  trails: TrailDetail[];
}

const DESKTOP_QUERY = "(min-width: 1024px)";

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
    sw: {
      lat: Math.min(...boxes.map((b) => b.sw.lat)),
      lon: Math.min(...boxes.map((b) => b.sw.lon)),
    },
    ne: {
      lat: Math.max(...boxes.map((b) => b.ne.lat)),
      lon: Math.max(...boxes.map((b) => b.ne.lon)),
    },
  };
}

export function HomeExplorer({ trails }: Props) {
  const { date, time, hours, withKids } = useTripSettings();
  const { start } = useUserLocation();
  // The trail whose day is shown under the map: last hovered / tapped, sticky on mouse-out.
  const [panelSlug, setPanelSlug] = useState<string | null>(null);
  const [showMapOnPhone, setShowMapOnPhone] = useState(false);
  const [trackPoints, setTrackPoints] = useState<Record<string, [number, number][]>>({});
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const isDesktop = useIsDesktop();

  // Static GPX files are small, so every track is loaded client-side.
  useEffect(() => {
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
  }, [trails]);

  // Drive time to every trail in one request, in `trails` order.
  const destinations = useMemo(() => trails.map((t) => driveDestination(t)), [trails]);
  const routable = useMemo(() => destinations.filter((d): d is LatLng => d !== null), [destinations]);
  const { matrix } = useDriveMatrix(start, routable);
  const driveBySlug = useMemo(() => {
    const out: Record<string, number | null> = {};
    let j = 0;
    trails.forEach((t, i) => {
      out[t.trail.slug] = destinations[i] ? (matrix?.durationsMin[j++] ?? null) : null;
    });
    return out;
  }, [trails, destinations, matrix]);

  // Every input feeds straight into this: filter by kids + whole-day budget, plan each day, sort.
  const items = useMemo<TrailListItem[]>(() => {
    const list = filterTrails(trails, { withKids }).flatMap((detail) => {
      const driveMin = driveBySlug[detail.trail.slug] ?? null;
      const totalMin = detail.trail.duration_min + 2 * (driveMin ?? 0);
      if (totalMin > hours * 60) return [];
      const th = primaryTrailhead(detail);
      const sun = sunLocation(detail);
      return [
        {
          detail,
          driveMin,
          distanceFromUserM: start && th ? haversineM(start, th.location) : null,
          plan:
            date && time && sun
              ? planDay({ date, start: time, driveMin, hikeMin: detail.trail.duration_min, location: sun })
              : null,
        },
      ];
    });
    const key = (i: TrailListItem) => i.driveMin ?? (i.distanceFromUserM ?? Infinity) / 1000;
    if (start) list.sort((a, b) => key(a) - key(b));
    return list;
  }, [trails, withKids, hours, date, time, start, driveBySlug]);

  const matchSlugs = useMemo(() => new Set(items.map((m) => m.detail.trail.slug)), [items]);

  const panelDetail =
    trails.find((t) => t.trail.slug === panelSlug && matchSlugs.has(panelSlug)) ?? items[0]?.detail ?? null;
  const activeSlug = panelDetail?.trail.slug ?? null;
  const panelDrive = useDriveRoute(start, panelDetail ? driveDestination(panelDetail) : null);

  const tracks = useMemo<MapTrack[]>(
    () =>
      trails.map(({ trail }) => ({
        slug: trail.slug,
        label: trail.name,
        points: trackPoints[trail.slug] ?? [],
        difficulty: trail.difficulty,
        state:
          trail.slug === activeSlug ? "selected" : matchSlugs.has(trail.slug) ? "normal" : "dimmed",
      })),
    [trails, trackPoints, activeSlug, matchSlugs]
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
            dimmed: !matchSlugs.has(detail.trail.slug),
            trailSlug: detail.trail.slug,
          },
        ];
      }),
    [trails, matchSlugs]
  );

  const bounds = useMemo(() => unionBounds(trails), [trails]);

  const registerItem = useCallback((slug: string, el: HTMLElement | null) => {
    if (el) itemRefs.current.set(slug, el);
    else itemRefs.current.delete(slug);
  }, []);

  const handleMapSelect = useCallback((slug: string) => {
    setPanelSlug(slug);
    itemRefs.current.get(slug)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const map = (
    <TrailMap
      tracks={tracks}
      markers={markers}
      bounds={bounds}
      onSelectTrail={handleMapSelect}
      driveLeg={panelDrive.route?.points}
      ariaLabel="Prehľadová mapa všetkých trás"
    />
  );

  return (
    <main className="flex flex-1 flex-col lg:h-dvh lg:flex-row">
      <div className="flex w-full flex-col gap-5 px-4 py-6 lg:w-[420px] lg:shrink-0 lg:overflow-y-auto">
        <nav aria-label="Hlavná navigácia">
          <SavedTripsLink />
        </nav>

        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-[var(--accent)]">MounTour</h1>
          <p className="text-sm opacity-70">
            Vyber si jednodňový výlet - trasu, parkovanie a kedy sa ešte stihneš vrátiť pred tmou.
          </p>
        </header>

        <TrailPicker hasDrive={start !== null && matrix !== null} />

        {!isDesktop && (
          <button
            type="button"
            onClick={() => setShowMapOnPhone((v) => !v)}
            aria-expanded={showMapOnPhone}
            className="w-fit rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
          >
            {showMapOnPhone ? "Skryť mapu" : "Zobraziť mapu"}
          </button>
        )}
        {!isDesktop && showMapOnPhone && (
          <div className="h-[40vh] overflow-hidden rounded-xl border border-[var(--border)]">{map}</div>
        )}

        <TrailList
          items={items}
          total={trails.length}
          activeSlug={isDesktop ? activeSlug : null}
          onActiveChange={setPanelSlug}
          registerItem={registerItem}
        />
      </div>

      {isDesktop && (
        <div className="sticky top-0 flex h-dvh flex-1 flex-col border-l border-[var(--border)]">
          <div className="min-h-0 flex-1">{map}</div>
          {panelDetail && (
            <div className="h-[42vh] shrink-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--card-bg)] p-4">
              <DayPlanView
                title={panelDetail.trail.name}
                sun={sunLocation(panelDetail)}
                destination={driveDestination(panelDetail)}
                hikeMin={panelDetail.trail.duration_min}
              />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
