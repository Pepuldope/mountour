import type { Metadata } from "next";
import Link from "next/link";
import { SavedTripsList } from "@/components/SavedTripsList";

export const metadata: Metadata = { title: "Moje výlety - MounTour" };

export default function SavedTripsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <Link href="/" className="w-fit text-sm font-semibold text-[var(--accent)]">
        ← Kam dnes
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.65rem] font-extrabold">Moje výlety</h1>
        <p className="text-sm text-[var(--muted)]">Uložené len v tomto zariadení. Fungujú aj bez signálu.</p>
      </header>
      <SavedTripsList />
    </main>
  );
}
