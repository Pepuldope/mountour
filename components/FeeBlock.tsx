"use client";

import type { Fee } from "@/lib/tripSchema";
import { useLang, useT } from "@/lib/i18n";
import { tr } from "@/lib/lang";
import type { Lang } from "@/lib/lang";

interface Props {
  fees: Fee[];
}

/** OSM gives raw tags ("Vstupné: 12 EUR/person"); fee rules carry their own Slovak text. */
function feeText(fee: Fee, lang: Lang): string {
  if (fee.source === "rule") return tr(lang, fee.text);
  const label = tr(lang, fee.kind === "parkovne" ? "Parkovné" : "Vstupné");
  return fee.amount_eur !== null
    ? `${label} ${fee.amount_eur.toLocaleString(lang === "en" ? "en-GB" : "sk-SK")} €.`
    : tr(lang, "{what} sa platí, výšku nepoznáme.", { what: label });
}

/** "Vstupné": what costs money on the way, with where we know it from. */
export function FeeBlock({ fees }: Props) {
  const t = useT();
  const lang = useLang();
  return (
    <section className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <h2 className="text-base font-bold">{t("Vstupné")}</h2>
      {fees.map((fee, i) => (
        <p key={`${fee.rule_id ?? fee.source_url ?? i}`} className="text-sm">
          {feeText(fee, lang)}{" "}
          {fee.source_url && (
            <a href={fee.source_url} target="_blank" rel="noopener noreferrer" className="text-[var(--muted)] underline">
              {t("Zdroj")}
            </a>
          )}
        </p>
      ))}
      <p className="text-xs text-[var(--muted)]">{t("Ceny sa menia, pred výletom si ich overte.")}</p>
    </section>
  );
}
