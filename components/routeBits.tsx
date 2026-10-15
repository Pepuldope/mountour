import { ROUTE_COLOURS } from "@/lib/palette";
import type { RouteBrief } from "@/lib/tripSchema";

// Small pieces shared by the route list (trip page) and the route comparison page.

export const routeLabel = (r: RouteBrief) => r.route_label ?? (r.variant_of ? "Iná cesta" : "Hlavná cesta");
export const routeAccess = (r: RouteBrief) => (r.transit && !r.parking ? "len autobusom" : r.transit ? "autom aj autobusom" : "autom");
export const routeKm = (r: RouteBrief) => `${(r.distance_m / 1000).toFixed(1).replace(".", ",")} km`;

export function Dot({ i }: { i: number }) {
  return <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: ROUTE_COLOURS[i % ROUTE_COLOURS.length] }} />;
}

/** A start with no car park: the strongest warning the site has (the closure banner's amber frame). */
export function NoParkingWarning() {
  return (
    <span className="flex items-start gap-2 rounded-xl border-2 border-[var(--warn)] bg-[var(--warn-bg)] px-2.5 py-2 text-[13.5px] text-[var(--warn)]">
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0">
        <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 6v3.6M8 11.6v.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>
        <b className="block text-[14px]">Bez parkoviska</b>
        Pri štarte nie je kde nechať auto. Sem sa oplatí ísť autobusom.
      </span>
    </span>
  );
}
