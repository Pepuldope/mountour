import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { OptOutNote } from "@/components/OptOutNote";
import { StatsTables } from "@/components/StatsTables";

export const metadata: Metadata = { title: "Štatistika návštev", robots: { index: false, follow: false } };

/**
 * The monthly report for the proposal KPI "people who used Túruj on 4+
 * different days in a month". Only totals, nothing about any one visitor.
 * Sources, pages and events are in Umami. The page is prebuilt; the numbers
 * come fresh from /api/statistiky in the browser.
 */
export default function StatsPage() {
  return (
    <InfoPage
      title="Štatistika návštev"
      intro="Koľko rôznych ľudí prišlo v mesiaci a koľkí z nich aspoň 2 alebo 4 rôzne dni. Bežiaci mesiac sa priebežne dopĺňa."
    >
      <StatsTables />
      <OptOutNote />
    </InfoPage>
  );
}
