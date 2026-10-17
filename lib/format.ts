import type { DayPlan, Verdict } from "@/lib/dayPlan";
import type { DestinationKind } from "@/lib/tripSchema";
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
  pramen: "Prameň",
  hrad: "Hrad",
  ihrisko: "Ihrisko",
  utulna: "Útulňa",
};

export const GOAL_LABEL: Record<DestinationKind, string> = {
  vrchol: "Vrchol",
  vodopad: "Vodopád",
  pleso: "Pleso",
  hrad: "Hrad",
  vyhliadka: "Vyhliadka",
  jaskyna: "Jaskyňa",
  chata: "Chata",
  roklina: "Roklina",
  ine: "Výlet",
};

export const GOAL_PLURAL: Record<DestinationKind, string> = {
  vrchol: "Vrcholy",
  vodopad: "Vodopády",
  pleso: "Plesá",
  hrad: "Hrady",
  vyhliadka: "Vyhliadky",
  jaskyna: "Jaskyne",
  chata: "Chaty",
  roklina: "Rokliny",
  ine: "Iné",
};

/** Compact, for chips and the sun arc: "45 min", "3 h", "3 h 05". */
// Durations use non-breaking spaces so "4 h 2 min" never splits across two lines.
const NB = "\u00a0";

export function formatDurationShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}${NB}min`;
  return m === 0 ? `${h}${NB}h` : `${h}${NB}h${NB}${String(m).padStart(2, "0")}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}${NB}min`;
  if (m === 0) return `${h}${NB}h`;
  return `${h}${NB}h${NB}${m}${NB}min`;
}

/** "18,4 km": Slovak decimal comma. */
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

/** A walk to the trail or a stop: "350 m" under a kilometre, "2,4 km" from there. */
export function formatWalk(meters: number): string {
  return meters < 1000 ? `${meters} m` : formatDistance(meters);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateSk(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Non-breaking spaces: "12. 10. 2026" never splits across two lines.
  return `${d}.\u00a0${m}.\u00a0${y}`;
}

/** Straight-line distance for "X od teba": "850 m", "4,2 km", "12 km". */
export function formatFromUser(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(meters / 1000)} km`;
}

/** Stop names come in the cp.sk form "Valaská Dubová,,OcÚ" (town,,stop); shown as "Valaská Dubová, OcÚ". Links keep the raw name. */
export function stopLabel(name: string): string {
  return name.replace(/\s*,+\s*/g, ", ");
}

export const TRANSIT_LABEL: Record<TransitMode, string> = {
  autobus: "Autobus",
  elektricka: "Električka",
  vlak: "Vlak",
};

/** One-line verdict for list items. */
export const VERDICT_SHORT: Record<Verdict, string> = {
  ok: "stihnete za svetla",
  close: "za svetla, rezerva pod hodinu",
  tight: "tesne pred západom",
  "after-sunset": "končíte po západe",
  "after-dusk": "končíte potme",
};

/** Full verdict sentence for the plan card. */
export function verdictText(plan: DayPlan): string {
  const m = Math.abs(plan.marginMin);
  switch (plan.verdict) {
    case "ok":
      // Hours of light to spare: how many exactly doesn't matter.
      return m > 150 ? "Stihnete to za svetla." : `Stihnete to za svetla. Z túry budete späť ${formatDuration(m)} pred západom slnka.`;
    case "close":
      return `Stihnete to za svetla, späť ${formatDuration(m)} pred západom slnka. Rezerva je menej ako hodina.`;
    case "tight":
      return `Tesné: späť len ${formatDuration(m)} pred západom slnka. Vyrazte skôr.`;
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
  // Thousands get a space, as Slovak writes them: "1 460 výletov".
  return `${n.toLocaleString("sk-SK")} výletov`;
}
