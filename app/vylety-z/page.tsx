import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { BIG_TOWNS } from "@/lib/townTrips";
import { getTowns } from "@/lib/trips";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  title: "Výlety z miest na Slovensku",
  description: "Jednodňové výlety do hôr a prírody podľa mesta, odkiaľ idete: Bratislava, Košice, Žilina, Nitra a ďalších vyše 130 miest.",
  path: "/vylety-z",
});

const chip = "rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1.5 !no-underline !text-[var(--foreground)] hover:border-[var(--accent)]";

export default function TownsPage() {
  const towns = getTowns();
  const big = BIG_TOWNS.flatMap((id) => towns.filter((t) => t.id === id));
  const rest = towns.filter((t) => !BIG_TOWNS.includes(t.id)).sort((a, b) => a.name.localeCompare(b.name, "sk"));
  const list = (ts: typeof towns) => (
    <div className="flex flex-wrap gap-2">
      {ts.map((t) => (
        <Link key={t.id} href={`/vylety-z/${t.id}`} className={chip}>
          {t.name}
        </Link>
      ))}
    </div>
  );
  return (
    <InfoPage title="Výlety z miest" intro="Odkiaľ idete? Ukážeme výlety do hodiny a pol autom.">
      {list(big)}
      <h2>Ďalšie mestá</h2>
      {list(rest)}
    </InfoPage>
  );
}
