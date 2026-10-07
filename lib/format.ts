import type { Difficulty, PoiKind } from "@/lib/types";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  lahka: "Lahka",
  stredna: "Stredna",
  tazka: "Tazka",
};

export const POI_LABEL: Record<PoiKind, string> = {
  vyhliadka: "Vyhliadka",
  chata: "Chata",
  obcerstvenie: "Obcerstvenie",
  pramen: "Pramen",
  hrad: "Hrad",
  ihrisko: "Ihrisko",
  utulna: "Utulna",
};

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateSk(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
