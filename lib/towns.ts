import type { LatLng } from "@/lib/types";

export interface Town extends LatLng {
  label: string;
}

/** One-tap start points: the kraj capitals plus Poprad, centre coordinates. */
export const TOWNS: Town[] = [
  { label: "Bratislava", lat: 48.1486, lon: 17.1077 },
  { label: "Košice", lat: 48.7164, lon: 21.2611 },
  { label: "Žilina", lat: 49.2231, lon: 18.7394 },
  { label: "Banská Bystrica", lat: 48.7363, lon: 19.1462 },
  { label: "Nitra", lat: 48.3069, lon: 18.0864 },
  { label: "Prešov", lat: 48.9984, lon: 21.2339 },
  { label: "Trnava", lat: 48.3774, lon: 17.5872 },
  { label: "Trenčín", lat: 48.8945, lon: 18.0444 },
  { label: "Poprad", lat: 49.0598, lon: 20.2975 },
];
