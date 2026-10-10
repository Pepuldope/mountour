import type { ParkingLot } from "@/lib/types";
import { formatDateSk } from "@/lib/format";

interface Props {
  parking: ParkingLot | null;
}

/** Where to leave the car. Navigation buttons sit with the plan above. */
export function ParkingBlock({ parking }: Props) {
  return (
    <section className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <h2 className="text-base font-bold">Parkovanie</h2>
      {parking ? (
        <>
          <p className="font-semibold">{parking.name}</p>
          {parking.note && <p className="text-sm text-[var(--muted)]">{parking.note}</p>}
          <p className="text-sm">
            <span className="text-[var(--muted)]">Súradnice: </span>
            <span className="font-data select-all">
              {parking.location.lat.toFixed(5)}, {parking.location.lon.toFixed(5)}
            </span>
          </p>
          {parking.verified_on && (
            <p className="text-xs text-[var(--muted)]">Overené: {formatDateSk(parking.verified_on)}</p>
          )}
        </>
      ) : (
        <p className="text-sm">Pri začiatku trasy nemáme overené parkovisko. Skúste vlak alebo autobus.</p>
      )}
    </section>
  );
}
