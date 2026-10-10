import type { Metadata } from "next";
import Link from "next/link";
import { SavedTripsList } from "@/components/SavedTripsList";

export const metadata: Metadata = { title: "Uložené výlety - MounTour" };

export default function SavedTripsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <Link href="/" className="w-fit text-sm font-medium text-[var(--accent)] underline">
        Späť na zoznam trás
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[var(--accent)]">Uložené výlety</h1>
        <p className="text-sm opacity-70">Uložené len v tomto zariadení. Fungujú aj bez signálu.</p>
      </header>
      <SavedTripsList />
    </main>
  );
}
