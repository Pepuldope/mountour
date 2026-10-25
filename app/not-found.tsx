import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { LangLink, T } from "@/lib/i18n";

export const metadata: Metadata = { title: "Stránka sa nenašla", robots: { index: false } };

export default function NotFound() {
  return (
    <InfoPage title="Túto stránku sme nenašli" intro="Možno sa trasa premenovala alebo odkaz nie je celý. Všetky výlety nájdete v zozname.">
      <LangLink
        href="/"
        className="w-fit rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--accent-contrast)]! no-underline!"
      >
        <T>Späť na výlety</T>
      </LangLink>
    </InfoPage>
  );
}
