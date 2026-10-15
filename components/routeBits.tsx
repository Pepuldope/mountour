import { ROUTE_COLOURS } from "@/lib/palette";
import type { RouteBrief } from "@/lib/tripSchema";

// Small pieces shared by the route list (trip page) and the route comparison page.

export const routeLabel = (r: RouteBrief) => r.route_label ?? (r.variant_of ? "Iná cesta" : "Hlavná cesta");
export const routeAccess = (r: RouteBrief) => (r.transit && !r.parking ? "len autobusom" : r.transit ? "autom aj autobusom" : "autom");
export const routeKm = (r: RouteBrief) => `${(r.distance_m / 1000).toFixed(1).replace(".", ",")} km`;

export function Dot({ i }: { i: number }) {
  return <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: ROUTE_COLOURS[i % ROUTE_COLOURS.length] }} />;
}

const warnTriangle = (
  <svg aria-hidden width="12" height="12" viewBox="0 0 16 16" className="shrink-0">
    <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M8 6v3.6M8 11.6v.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** A start with no car park: an amber chip next to the route's name. */
export function NoParkingChip() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] border-[var(--warn)] bg-[var(--warn-bg)] px-2 py-px text-[12px] font-extrabold text-[var(--warn)]">
      {warnTriangle}
      Bez parkoviska
    </span>
  );
}

/** Said next to the no-parking chip, so it is plain the place is still easy to reach. */
export function BusOk() {
  return (
    <span className="inline-flex items-center gap-1 font-bold text-[var(--ok)]">
      <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" className="shrink-0">
        <rect x="2.5" y="1.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.5 7.5h11M4.5 12.5v2M11.5 12.5v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="5.3" cy="10" r=".9" fill="currentColor" />
        <circle cx="10.7" cy="10" r=".9" fill="currentColor" />
      </svg>
      dá sa autobusom
    </span>
  );
}
