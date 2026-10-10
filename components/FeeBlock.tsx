import type { Fee } from "@/lib/tripSchema";

interface Props {
  fees: Fee[];
}

/** OSM gives raw tags ("Vstupné: 12 EUR/person"); fee rules carry their own Slovak text. */
function feeText(fee: Fee): string {
  if (fee.source === "rule") return fee.text;
  const label = fee.kind === "parkovne" ? "Parkovné" : "Vstupné";
  return fee.amount_eur !== null
    ? `${label} ${fee.amount_eur.toLocaleString("sk-SK")} €.`
    : `${label} sa platí, výšku nepoznáme.`;
}

/** "Vstupné": what costs money on the way, with where we know it from. */
export function FeeBlock({ fees }: Props) {
  return (
    <section className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <h2 className="text-base font-bold">Vstupné</h2>
      {fees.map((fee, i) => (
        <p key={`${fee.rule_id ?? fee.source_url ?? i}`} className="text-sm">
          {feeText(fee)}{" "}
          {fee.source_url && (
            <a href={fee.source_url} target="_blank" rel="noopener noreferrer" className="text-[var(--muted)] underline">
              Zdroj
            </a>
          )}
        </p>
      ))}
      <p className="text-xs text-[var(--muted)]">Ceny sa menia, pred výletom si ich overte.</p>
    </section>
  );
}
