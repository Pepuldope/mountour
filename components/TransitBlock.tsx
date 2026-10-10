import type { TransitStop } from "@/lib/types";
import { TRANSIT_LABEL } from "@/lib/format";

interface Props {
  stops: TransitStop[];
}

const MODE_GLYPH: Record<TransitStop["mode"], string> = {
  autobus: "A",
  elektricka: "E",
  vlak: "V",
};

// cp.sk prefills the "from" field from ?t=; checked to return HTTP 200.
function cpSkUrl(stopName: string): string {
  return `https://cp.sk/vlakbusmhd/spojenie/?t=${encodeURIComponent(stopName)}`;
}

export function TransitBlock({ stops }: Props) {
  const sorted = [...stops].sort((a, b) => a.distance_m - b.distance_m);

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <h2 className="text-sm font-semibold opacity-70">Verejná doprava</h2>

      {sorted.length === 0 ? (
        <>
          <p className="text-sm opacity-80">
            Pri začiatku trasy sme nenašli zastávku verejnej dopravy.
          </p>
          <a
            href="https://cp.sk/"
            data-umami-event="transit_open"
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-sm font-medium text-[var(--accent)] underline"
          >
            Vyhľadať spoj na cp.sk
          </a>
        </>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((s) => (
            <li key={s.id} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-xs font-bold text-[var(--accent-contrast)]"
              >
                {MODE_GLYPH[s.mode]}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{s.name}</span>
                <span className="text-xs opacity-70">
                  {TRANSIT_LABEL[s.mode]} - {s.distance_m} m od začiatku trasy
                </span>
              </div>
              <a
                href={cpSkUrl(s.name)}
                data-umami-event="transit_open"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-medium text-[var(--accent)] underline"
              >
                Spoj na cp.sk
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
