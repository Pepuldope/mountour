import { ROUTE_COLOURS } from "@/lib/palette";
import type { RouteBrief } from "@/lib/tripSchema";

// Small pieces shared by the route list (trip page) and the route comparison page.

export const routeLabel = (r: RouteBrief) => r.route_label ?? (r.variant_of ? "Iná cesta" : "Hlavná cesta");
export const routeAccess = (r: RouteBrief) => (r.transit && !r.parking ? "len autobusom" : r.transit ? "autom aj autobusom" : "autom");
export const routeKm = (r: RouteBrief) => `${(r.distance_m / 1000).toFixed(1).replace(".", ",")} km`;

export function Dot({ i }: { i: number }) {
  return <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: ROUTE_COLOURS[i % ROUTE_COLOURS.length] }} />;
}
