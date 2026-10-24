// Pictograms for goal and place kinds (24x24, drawn in currentColor), from the
// "Feel Lab" prototype. Plain SVG markup so both React and map pins can use it.
import type { DestinationKind, FoodKind, PoiKind } from "@/lib/tripSchema";

const W = 'fill="#fff" opacity=".85"';

export const KIND_ICON: Record<DestinationKind | PoiKind | FoodKind, string> = {
  vrchol: `<path d="M2.5 19.5 9.5 7l3.4 5.6 2.1-3.1 6.5 10z" fill="currentColor"/><path d="m8 9.6 1.5-2.6 1.6 2.6-1.6.9z" ${W}/>`,
  vodopad:
    '<path d="M4 4h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M8 6v9M12 6v11M16 6v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 19c2.5 1.6 13.5 1.6 16 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
  pleso:
    '<path d="M3 14c2-4.5 16-4.5 18 0-2 4.5-16 4.5-18 0z" fill="currentColor"/><path d="M8 14c1.3-1 2.7-1 4 0s2.7 1 4 0" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9"/><path d="m8 8 2.5-3.5L13 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  jaskyna: `<path d="M2.5 20C3 10 7 5 12 5s9 5 9.5 15z" fill="currentColor"/><path d="M8.5 20c0-4.5 1.5-7 3.5-7s3.5 2.5 3.5 7z" ${W}/>`,
  hrad: '<path d="M4 20V8.5h3V11h2.5V8.5h5V11H17V8.5h3V20h-6v-4.5a2 2 0 0 0-4 0V20z" fill="currentColor"/><path d="M12 3v4M12 3h3l-1 1 1 1h-3" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  vyhliadka:
    '<path d="M7 20 10.5 7h3L17 20" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/><path d="M6.5 7h11L12 2.5z" fill="currentColor"/><path d="M8.5 14h7" stroke="currentColor" stroke-width="2"/>',
  chata: `<path d="M2.5 11.5 12 4l9.5 7.5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M5 10.5V20h14v-9.5L12 5z" fill="currentColor"/><rect x="10" y="14" width="4" height="6" ${W}/>`,
  roklina:
    '<path d="M2.5 20 5 4h4.5L8 12l1.5 8z" fill="currentColor"/><path d="M21.5 20 19 4h-4.5l1.5 8-1.5 8z" fill="currentColor"/><path d="M12 5.5v3M12 11v3M12 16.5v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  ine: `<circle cx="12" cy="12" r="7" fill="currentColor"/><circle cx="12" cy="12" r="2.6" ${W}/>`,
  obcerstvenie:
    '<path d="M4.5 8h11v5a5.5 5.5 0 0 1-11 0z" fill="currentColor"/><path d="M15.5 9.5h1.5a2.3 2.3 0 0 1 0 4.6h-1.8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 3.5c-.8 1 .8 1.7 0 2.8M11.5 3.5c-.8 1 .8 1.7 0 2.8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  pramen:
    '<path d="M12 3c4.2 5 6.2 8.3 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 11.3 7.8 8 12 3z" fill="currentColor"/><path d="M9 14.5a3 3 0 0 0 3 3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9"/>',
  utulna: `<path d="M2.5 20 12 4.5 21.5 20z" fill="currentColor"/><path d="M12 11 9 20h6z" ${W}/>`,
  ihrisko:
    '<path d="M5 20V7M19 20V7M5 7h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M9 7v7M15 7v7" stroke="currentColor" stroke-width="1.6"/><rect x="7.5" y="14" width="9" height="2.4" rx="1" fill="currentColor"/>',
  // Food places by kind (Peter, 2026-10-24): fork and knife, a cup, a sandwich.
  restauracia:
    '<path d="M5.5 3v5.2a2.5 2.5 0 0 0 5 0V3M8 3v18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 21V3c-2.4 1.4-3.6 4.6-3.6 9H18" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
  kaviaren:
    '<path d="M4.5 8h11v5a5.5 5.5 0 0 1-11 0z" fill="currentColor"/><path d="M15.5 9.5h1.5a2.3 2.3 0 0 1 0 4.6h-1.8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 3.5c-.8 1 .8 1.7 0 2.8M11.5 3.5c-.8 1 .8 1.7 0 2.8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  bufet:
    '<path d="M2.5 11.5C2.5 8 6.8 6 12 6s9.5 2 9.5 5.5z" fill="currentColor"/><circle cx="8.5" cy="8.6" r=".8" fill="#fff" opacity=".85"/><circle cx="12" cy="7.9" r=".8" fill="#fff" opacity=".85"/><circle cx="15.5" cy="8.6" r=".8" fill="#fff" opacity=".85"/><path d="M3 14c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><rect x="2.5" y="16" width="19" height="3.6" rx="1.8" fill="currentColor"/>',
};

export function kindSvg(kind: DestinationKind | PoiKind | FoodKind, size = 24): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${KIND_ICON[kind]}</svg>`;
}
