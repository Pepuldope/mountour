import Link from "next/link";
import { formatDuration } from "@/lib/format";
import { ROUTE_COLOURS } from "@/lib/palette";
import type { RouteBrief } from "@/lib/tripSchema";

interface Props {
  /** The trip on screen. */
  slug: string;
  destination: string;
  /** The main route first, then the others (the trip file's "routes"). */
  routes: RouteBrief[];
}

export const routeLabel = (r: RouteBrief) => r.route_label ?? (r.variant_of ? "Iná cesta" : "Hlavná cesta");
export const routeAccess = (r: RouteBrief) => (r.transit && !r.parking ? "len autobusom" : r.transit ? "autom aj autobusom" : "autom");
export const routeKm = (r: RouteBrief) => `${(r.distance_m / 1000).toFixed(1).replace(".", ",")} km`;
const plural = (n: number) => (n >= 5 ? `${n} ciest` : `${n} cesty`);

function Dot({ i }: { i: number }) {
  return <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: ROUTE_COLOURS[i % ROUTE_COLOURS.length] }} />;
}

/**
 * Most places have more than one marked route. The page shows the main one (the start most
 * people use); here you switch to another. Phones get one folded "Cesta" row so the page stays
 * easy to scroll; wider screens list the routes as cards. Both link to the map comparison.
 */
export function RouteChoice({ slug, destination, routes }: Props) {
  if (routes.length < 2) return null;
  const at = Math.max(0, routes.findIndex((r) => r.slug === slug));
  const current = routes[at];
  const compare = `/trasa/${slug}/cesty`;

  const rows = routes.map((r, i) => (
    <li key={r.slug}>
      <Link
        href={`/trasa/${r.slug}`}
        aria-current={i === at ? "page" : undefined}
        scroll={false}
        className={`flex items-center gap-3 px-3.5 py-2.5 ${i === at ? "bg-[var(--accent-soft)]" : ""}`}
      >
        <Dot i={i} />
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-bold">{routeLabel(r)}</span>
          <span className="text-[13px] text-[var(--muted)]">
            štart {r.start_name} · {routeAccess(r)}
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

  return (
    <section aria-label={`Cesty na ${destination}`} className="flex flex-col gap-2">
      {/* Phones: one row, opened on a tap. */}
      <details className="group overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)] lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
          <Dot i={at} />
          <span className="flex min-w-0 flex-col">
            <span className="text-[12px] text-[var(--muted)]">Cesta</span>
            <span className="truncate text-[15px] font-bold">
              {routeLabel(current)} · {current.start_name}
            </span>
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[13px] font-bold text-[var(--accent)]">
            {plural(routes.length)}
            <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className="transition-transform group-open:rotate-180">
              <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </summary>
        <ul className="flex flex-col divide-y divide-[var(--border)] border-t border-[var(--border)]">{rows}</ul>
        <Link href={compare} className="block border-t border-[var(--border)] px-3.5 py-2.5 text-sm font-bold text-[var(--accent)]">
          Porovnať cesty na mape ›
        </Link>
      </details>

      {/* Wider screens: every route as a card. */}
      <div className="hidden flex-col gap-2 lg:flex">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold">Cesty na {destination}</h2>
          <Link href={compare} className="text-sm font-bold text-[var(--accent)]">
            Porovnať na mape ›
          </Link>
        </div>
        <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)]">
          {rows}
        </ul>
      </div>
    </section>
  );
}
