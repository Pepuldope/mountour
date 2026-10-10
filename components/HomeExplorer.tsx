"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { BBox, TrailDetail } from "@/lib/types";
import { filterTrails } from "@/lib/data";
import { fetchTrack, gpxUrlFor } from "@/lib/gpx";
import { haversineM } from "@/lib/geo";
import { useUserLocation } from "@/lib/userLocation";
import { TrailPicker } from "@/components/TrailPicker";
import { TrailList } from "@/components/TrailList";
import type { TrailListItem } from "@/components/TrailList";
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

function primaryTrailhead(detail: TrailDetail) {
  return detail.trailheads.find((t) => t.is_primary) ?? detail.trailheads[0] ?? null;
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
  const [hours, setHours] = useState(4);
  const [withKids, setWithKids] = useState(false);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [trackPoints, setTrackPoints] = useState<Record<string, [number, number][]>>({});
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const isDesktop = useIsDesktop();
  const { start } = useUserLocation();

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

  const matches = useMemo(
    () => filterTrails(trails, { maxHours: hours, withKids }),
    [trails, hours, withKids]
  );
  const matchSlugs = useMemo(() => new Set(matches.map((m) => m.trail.slug)), [matches]);

  // With a known start, nearest trailhead first.
  const items = useMemo<TrailListItem[]>(() => {
    const list = matches.map((detail) => {
      const th = primaryTrailhead(detail);
      return {
        detail,
        distanceFromUserM: start && th ? haversineM(start, th.location) : null,
      };
    });
    if (start) {
      list.sort(
        (a, b) =>
          (a.distanceFromUserM ?? Number.POSITIVE_INFINITY) -
          (b.distanceFromUserM ?? Number.POSITIVE_INFINITY)
      );
    }
    return list;
  }, [matches, start]);

  const activeSlug = hoveredSlug ?? selectedSlug;

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
    setSelectedSlug(slug);
    itemRefs.current.get(slug)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const map = (
    <TrailMap
      tracks={tracks}
      markers={markers}
      bounds={bounds}
      onSelectTrail={handleMapSelect}
      ariaLabel="Prehľadová mapa všetkých trás"
    />
  );

  return (
    <main className="flex flex-1 flex-col lg:h-dvh lg:flex-row">
      <div className="flex w-full flex-col gap-5 px-4 py-6 lg:w-[420px] lg:shrink-0 lg:overflow-y-auto">
        <nav aria-label="Hlavná navigácia">
          <span
            aria-disabled="true"
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-sm opacity-60"
          >
            Uložené výlety
            <span className="text-xs">čoskoro</span>
          </span>
        </nav>

        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-[var(--accent)]">MounTour</h1>
          <p className="text-sm opacity-70">
            Vyber si jednodňový výlet - trasu, parkovanie a kedy sa ešte stihneš vrátiť pred tmou.
          </p>
        </header>

        <TrailPicker
          hours={hours}
          onHoursChange={setHours}
          withKids={withKids}
          onWithKidsChange={setWithKids}
        />

        {!isDesktop && (
          <div className="h-[35vh] overflow-hidden rounded-xl border border-[var(--border)]">
            {map}
          </div>
        )}

        <TrailList
          items={items}
          activeSlug={activeSlug}
          onActiveChange={setHoveredSlug}
          registerItem={registerItem}
        />
      </div>

      {isDesktop && (
        <div className="sticky top-0 h-dvh flex-1 border-l border-[var(--border)]">{map}</div>
      )}
    </main>
  );
}
