import { getAllTrails } from "@/lib/data";
import { TrailPicker } from "@/components/TrailPicker";

export default async function Home() {
  const trails = await getAllTrails();

  return (
    <main className="flex-1 flex flex-col mx-auto w-full max-w-lg px-4 py-6 gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[var(--accent)]">MounTour</h1>
        <p className="text-sm opacity-70">
          Vyber si jednodnovy vylet - trasu, parkovanie a kedy sa este stihnes vratit pred tmou.
        </p>
      </header>

      <TrailPicker trails={trails} />
    </main>
  );
}
