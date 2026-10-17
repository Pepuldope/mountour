"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDuration } from "@/lib/format";
import type { RouteBrief } from "@/lib/tripSchema";
import { useTripSettings } from "@/lib/tripSettings";
import { formatKm, pickWalk, walkMinutes } from "@/lib/walkFacts";
import type { RouteWalk } from "@/lib/walkFacts";
import { useTripAccess } from "@/components/TripAccess";
import { setHoveredRoute, useHoveredRoute } from "@/lib/routeHover";
import { BusOk, Dot, NoParkingChip, routeAccess, routeLabel } from "@/components/routeBits";

export interface RouteNumbers {
  min: number;
  km: string;
  ascentM: number;
}

/**
 * Each route's walk as its own trip page counts it (lib/walkFacts.ts): from the default parking or
 * stop, at the group's pace. The route on screen (`current`, inside its trip page) takes the parking
 * or stop picked there, so its row says what the facts above say.
 */
export function useRouteNumbers(routes: RouteBrief[], walks: Record<string, RouteWalk>, current: string | null): RouteNumbers[] {
  const { travel, withKids } = useTripSettings();
  const { walk } = useTripAccess();
  // Memoised: the comparison map re-adds its pins when their lines change.
  return useMemo(
    () =>
      routes.map((r) => {
        const w = r.slug === current ? walk : pickWalk(walks[r.slug], travel === "transit", r.parking);
        return w
          ? { min: walkMinutes(w, withKids), km: formatKm(w.m), ascentM: w.ascentM }
          : { min: r.duration_min, km: formatKm(r.distance_m), ascentM: r.ascent_m };
      }),
    [routes, walks, current, walk, travel, withKids]
  );
}

/** The routes as rows; the one under the pointer (here or on the map) gets an outline and lights up on the map. */
export function RouteRows({ routes, at, walks }: { routes: RouteBrief[]; at: number; walks: Record<string, RouteWalk> }) {
  const hovered = useHoveredRoute();
  const numbers = useRouteNumbers(routes, walks, routes[at]?.slug ?? null);
  return routes.map((r, i) => (
    <li key={r.slug}>
      <Link
        href={`/trasa/${r.slug}`}
        aria-current={i === at ? "page" : undefined}
        scroll={false}
        onMouseEnter={() => setHoveredRoute(i === at ? null : r.slug)}
        onMouseLeave={() => setHoveredRoute(null)}
        onClick={() => setHoveredRoute(null)}
        className={`flex items-center gap-3 px-3.5 py-2.5 outline-offset-[-2px] ${i === at ? "bg-[var(--accent-soft)]" : ""} ${
          hovered === r.slug ? "outline-2 outline-[var(--accent)] outline" : ""
        }`}
      >
        <Dot i={i} />
        <span className="flex min-w-0 flex-col">
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[15px] font-bold">
            {routeLabel(r)}
            {!r.parking && <NoParkingChip />}
          </span>
          <span className="text-[13px] text-[var(--muted)]">
            štart {r.start_name} · {r.parking ? routeAccess(r) : <BusOk />}
          </span>
        </span>
        <span className="font-data ml-auto shrink-0 text-right text-[16px] leading-tight">
          {formatDuration(numbers[i].min)}
          <span className="block font-sans text-[12px] text-[var(--muted)]">
            {numbers[i].km} · +{numbers[i].ascentM} m
          </span>
        </span>
      </Link>
    </li>
  ));
}
