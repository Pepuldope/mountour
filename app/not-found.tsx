import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";

export const metadata: Metadata = { title: "Stránka sa nenašla", robots: { index: false } };

export default function NotFound() {
  return (
    <InfoPage title="Túto stránku sme nenašli" intro="Možno sa trasa premenovala alebo odkaz nie je celý. Výlety na dnes nájdete v zozname.">
      <Link
        href="/"
        className="w-fit rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--accent-contrast)]! no-underline!"
      >
        Ukážte výlety na dnes
      </Link>
    </InfoPage>
  );
}
