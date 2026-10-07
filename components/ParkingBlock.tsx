import type { ParkingLot } from "@/lib/types";
import { formatDateSk } from "@/lib/format";

interface Props {
  parking: ParkingLot;
}

export function ParkingBlock({ parking }: Props) {
  const { lat, lon } = parking.location;
  const coordText = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  const geoUri = `geo:${lat},${lon}`;
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <h2 className="text-sm font-semibold opacity-70">Parkovanie</h2>
      <p className="text-lg font-semibold">{parking.name}</p>
      {parking.note && <p className="text-sm opacity-80">{parking.note}</p>}

      <p className="text-sm">
        Suradnice: <span className="select-all font-mono">{coordText}</span>
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href={geoUri}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
        >
          Otvoriť v mapovej aplikácii
        </a>
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)]"
        >
          Navigacia (Google Maps)
        </a>
      </div>

      {parking.verified_on && (
        <p className="text-xs opacity-60">Overené: {formatDateSk(parking.verified_on)}</p>
      )}
    </section>
  );
}
