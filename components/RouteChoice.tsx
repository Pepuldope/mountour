import Link from "next/link";
import { formatDuration } from "@/lib/format";
import type { RouteBrief } from "@/lib/tripSchema";

interface Props {
  /** The trip on screen. */
  slug: string;
  destination: string;
  /** The main route first, then the others (the trip file's "routes"). */
  routes: RouteBrief[];
}

/**
 * Most places have more than one marked route. The page shows the main one (the
 * start most people use); here you switch to another, each with why you might want it.
 */
export function RouteChoice({ slug, destination, routes }: Props) {
  if (routes.length < 2) return null;
  return (
    <section aria-labelledby="cesty" className="flex flex-col gap-2">
      <h2 id="cesty" className="text-base font-bold">
        Cesty na {destination}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {routes.map((r) => {
          const current = r.slug === slug;
          return (
            <li key={r.slug}>
              <Link
                href={`/trasa/${r.slug}`}
                aria-current={current ? "page" : undefined}
                scroll={false}
                className={`flex items-center justify-between gap-3 rounded-[var(--radius-card)] border bg-[var(--card-bg)] px-3.5 py-2.5 ${
                  current ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]" : "border-[var(--border)]"
                }`}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-bold">{r.route_label ?? (r.variant_of ? "Iná cesta" : "Hlavná cesta")}</span>
                  <span className="text-[13px] text-[var(--muted)]">
                    štart {r.start_name}
                    {r.transit && !r.parking ? " · len autobusom" : r.transit ? " · aj autobusom" : ""}
                  </span>
                </span>
                <span className="font-data shrink-0 text-right text-[16px] leading-tight">
                  {formatDuration(r.duration_min)}
                  <span className="block font-sans text-[12px] text-[var(--muted)]">
                    {(r.distance_m / 1000).toFixed(1).replace(".", ",")} km · +{r.ascent_m} m
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
