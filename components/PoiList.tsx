import { KindIcon } from "@/components/KindIcon";
import { POI_LABEL } from "@/lib/format";
import { POI_COLOUR } from "@/lib/palette";
import type { Poi } from "@/lib/types";

function km(m: number): string {
  return m < 150 ? "pri štarte" : `${(m / 1000).toLocaleString("sk-SK", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;
}

/** "Na trase": huts, springs, viewpoints... in the order the walk reaches them. */
export function PoiList({ pois }: { pois: Poi[] }) {
  if (pois.length === 0) return null;
  const word = pois.length === 1 ? "miesto" : pois.length < 5 ? "miesta" : "miest";
  return (
    <details open className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)]">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-base font-bold">
        Na trase
        <span className="ml-auto text-sm font-medium text-[var(--muted)]">
          {pois.length} {word}
        </span>
      </summary>
      <ul className="flex flex-col gap-2 px-4 pb-3">
        {pois.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5">
            <KindIcon kind={p.kind} colour={POI_COLOUR[p.kind]} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{p.name}</span>
              <span className="text-xs text-[var(--muted)]">
                <span className="font-bold" style={{ color: POI_COLOUR[p.kind] }}>
                  {POI_LABEL[p.kind]}
                </span>
                {p.along_m !== null ? ` · ${km(p.along_m)}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
