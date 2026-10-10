import type { DayPlan, Verdict } from "@/lib/dayPlan";
import type { Difficulty, PoiKind, TransitMode } from "@/lib/types";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  lahka: "Ľahká",
  stredna: "Stredná",
  tazka: "Ťažká",
};

export const POI_LABEL: Record<PoiKind, string> = {
  vyhliadka: "Vyhliadka",
  chata: "Chata",
  obcerstvenie: "Občerstvenie",
  pramen: "Pramen",
  hrad: "Hrad",
  ihrisko: "Ihrisko",
  utulna: "Útulňa",
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

/** Straight-line distance for "X od teba": "850 m", "4,2 km", "12 km". */
export function formatFromUser(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(meters / 1000)} km`;
}

export const TRANSIT_LABEL: Record<TransitMode, string> = {
  autobus: "Autobus",
  elektricka: "Električka",
  vlak: "Vlak",
};

/** One-line verdict for list items. */
export const VERDICT_SHORT: Record<Verdict, string> = {
  ok: "stihnete za svetla",
  tight: "tesne pred západom",
  "after-sunset": "končíte po západe",
  "after-dusk": "končíte potme",
};

/** Full verdict sentence for the plan card. */
export function verdictText(plan: DayPlan): string {
  const m = Math.abs(plan.marginMin);
  switch (plan.verdict) {
    case "ok":
      return `Stihnete to za svetla. Z túry budete späť ${formatDuration(m)} pred západom slnka.`;
    case "tight":
      return `Tesné. Z túry budete späť len ${formatDuration(m)} pred západom slnka. Ak sa dá, vyrazte skôr.`;
    case "after-sunset":
      return `Koniec túry vychádza ${formatDuration(m)} po západe slnka, v šere. Vyrazte skôr.`;
    case "after-dusk":
      return "Posledná časť túry by bola potme. Vyrazte skôr alebo vyberte kratšiu trasu.";
  }
}

/** "1 výlet", "3 výlety", "12 výletov". */
export function tripsCount(n: number): string {
  if (n === 1) return "1 výlet";
  if (n >= 2 && n <= 4) return `${n} výlety`;
  return `${n} výletov`;
}
