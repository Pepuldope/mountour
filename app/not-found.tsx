import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Stránka sa nenašla", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-[var(--accent)]">Túto stránku sme nenašli</h1>
      <p className="text-sm opacity-80">Možno sa trasa premenovala alebo odkaz nie je celý. Výlety na dnes nájdete v zozname.</p>
      <Link href="/" className="w-fit rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--accent-contrast)]">
        Ukážte výlety na dnes
      </Link>
    </main>
  );
}
