import type { Metadata } from "next";
import Link from "next/link";
import { SavedTripsList } from "@/components/SavedTripsList";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Moje výlety",
  robots: { index: false, follow: true },
};

export default function SavedTripsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <Link href="/" className="w-fit text-sm font-semibold text-[var(--accent)]">
        ← Všetky výlety
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.65rem] leading-tight font-extrabold">Moje výlety</h1>
        <p className="text-sm text-[var(--muted)]">Uložené len v tomto zariadení. Pri každom výlete vidíte, či funguje aj bez signálu.</p>
      </header>
      <SavedTripsList />
      <SiteFooter />
    </main>
  );
}
