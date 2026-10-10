import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { monthlyStats } from "@/lib/visitStore";

export const metadata: Metadata = { title: "Štatistika návštev", robots: { index: false, follow: false } };

// Always read fresh numbers.
export const dynamic = "force-dynamic";

/**
 * The monthly report for the proposal KPI "people who used MounTour on 4+
 * different days in a month". Only totals, nothing about any one visitor.
 * Sources, pages and events are in Umami.
 */
export default async function StatsPage() {
  const rows = await monthlyStats();

  return (
    <InfoPage
      title="Štatistika návštev"
      intro="Koľko rôznych ľudí prišlo v mesiaci a koľkí z nich aspoň 2 alebo 4 rôzne dni. Bežiaci mesiac sa priebežne dopĺňa."
    >
      {rows === null ? (
        <p>Počítadlo beží len na zverejnenej stránke (Cloudflare).</p>
      ) : rows.length === 0 ? (
        <p>Zatiaľ žiadne návštevy.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="py-2">Mesiac</th>
              <th>Ľudia</th>
              <th>2+ dni</th>
              <th>4+ dni</th>
              <th>Priemer dní</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-[var(--border)]">
                <td className="py-2">{r.month}</td>
                <td>{r.visitors}</td>
                <td>{r.visitors_2plus_days}</td>
                <td className="font-semibold">{r.visitors_4plus_days}</td>
                <td>{r.avg_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs opacity-70">
        Človek, ktorému sa medzi dňami zmení IP adresa (napr. mobil na inej sieti), sa počíta ako dvaja ľudia, takže
        čísla sú skôr nižšie ako skutočnosť.
      </p>
    </InfoPage>
  );
}
