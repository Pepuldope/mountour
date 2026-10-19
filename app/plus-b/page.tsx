import { InfoPage } from "@/components/InfoPage";
import { PlusWant } from "@/components/PlusWant";

// Prototype option B: free vs MounTour+ side by side. Not for merging.
const ROWS: [string, boolean, boolean][] = [
  ["Výlety, ktoré stihnete dnes", true, true],
  ["Plán dňa: odchod, parkovanie, uzávery, počasie", true, true],
  ["Poslať plán partii", true, true],
  ["Offline výlety", true, true],
  ["Víkendový tip každý piatok", false, true],
  ["Strážca výletu (počasie, uzávery, svetlo)", false, true],
  ["Neobmedzene offline výletov a máp", false, true],
];

export default function PlusPageB() {
  return (
    <InfoPage title="MounTour+" intro="Pre tých, čo chodia von často. Všetko, čo je dnes zadarmo, zadarmo aj ostane.">
      <section className="flex flex-col gap-3 rounded-xl bg-[var(--sun-soft)] p-4">
        <p>
          <span className="text-3xl font-extrabold">9,99 €</span> <span className="font-semibold">ročne</span>
          <span className="text-[var(--muted)]"> · menej ako jeden deň parkovania v Tatrách</span>
        </p>
        <PlusWant />
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--muted)]">
            <th className="py-2 font-semibold"></th>
            <th className="w-20 py-2 text-center font-semibold">Zadarmo</th>
            <th className="w-20 py-2 text-center font-semibold text-[var(--accent)]">MounTour+</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, free, plus], i) => (
            <tr key={label} className={`border-t border-[var(--border)] ${i >= 4 ? "font-semibold" : ""}`}>
              <td className="py-2.5 pr-2">{label}</td>
              <td className="text-center">{free ? (i === 3 ? "1 výlet" : "✓") : "–"}</td>
              <td className="text-center text-[var(--accent)]">{plus ? "✓" : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-[var(--muted)]">
        MounTour+ zatiaľ len pripravujeme. Poradie výletov sa nedá kúpiť, ani s MounTour+.
      </p>
    </InfoPage>
  );
}
