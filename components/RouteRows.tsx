"use client";

import Link from "next/link";
import { formatDuration } from "@/lib/format";
import type { RouteBrief } from "@/lib/tripSchema";
import { setHoveredRoute, useHoveredRoute } from "@/lib/routeHover";
import { Dot, routeAccess, routeKm, routeLabel } from "@/components/routeBits";

/** The routes as rows; the one under the pointer (here or on the map) gets an outline and lights up on the map. */
export function RouteRows({ routes, at }: { routes: RouteBrief[]; at: number }) {
  const hovered = useHoveredRoute();
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
          <span className="text-[15px] font-bold">{routeLabel(r)}</span>
          <span className="text-[13px] text-[var(--muted)]">
            štart {r.start_name} ·{" "}
            {r.parking ? routeAccess(r) : <span className="font-bold text-[var(--warn)]">⚠ bez parkoviska, len autobusom</span>}
          </span>
        </span>
        <span className="font-data ml-auto shrink-0 text-right text-[16px] leading-tight">
          {formatDuration(r.duration_min)}
          <span className="block font-sans text-[12px] text-[var(--muted)]">
            {routeKm(r)} · +{r.ascent_m} m
          </span>
        </span>
      </Link>
    </li>
  ));
}
