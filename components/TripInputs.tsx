"use client";

import { useTripPlan } from "@/lib/useTripPlan";
import { useUserLocation } from "@/lib/userLocation";
import type { LatLng } from "@/lib/types";
import { StartPicker } from "@/components/StartPicker";
import { DayInputs } from "@/components/DayInputs";
import { DayPlanView } from "@/components/DayPlanView";

interface Props {
  sun: LatLng | null;
  destination: LatLng | null;
  hikeMin: number;
}

/**
 * Trip page inputs. On phones the plan renders right under them (live feedback
 * without scrolling to a map); on desktop the plan sits under the map instead.
 */
export function TripInputs({ sun, destination, hikeMin }: Props) {
  const { start } = useUserLocation();
  const { route } = useTripPlan(sun, destination, hikeMin);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <h2 className="text-sm font-semibold opacity-70">Plán dňa</h2>
      <StartPicker />
      {!start && (
        <p className="text-xs opacity-70">Zadaj, odkiaľ vyrážaš, a do plánu pridáme aj cestu autom.</p>
      )}
      <DayInputs hasDrive={route !== null} />
      <div className="lg:hidden">
        <DayPlanView sun={sun} destination={destination} hikeMin={hikeMin} />
      </div>
    </section>
  );
}
