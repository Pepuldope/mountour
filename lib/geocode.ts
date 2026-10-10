/**
 * Place search via Nominatim (OpenStreetMap). Free, no key.
 *
 * Usage policy: max 1 request/s and NO search-as-you-type autocomplete, so we
 * only search when the user submits. https://operations.osmfoundation.org/policies/nominatim/
 */

export interface Place {
  lat: number;
  lon: number;
  /** Short Slovak label, e.g. "Pezinok, okres Pezinok". */
  label: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5" +
    "&countrycodes=sk,cz,at,hu,pl&accept-language=sk" +
    `&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const rows = (await res.json()) as NominatimResult[];
  return rows.map((r) => {
    const parts = r.display_name.split(", ");
    const head = r.name || parts[0];
    const rest = parts.filter((p) => p !== head).slice(0, 2);
    return {
      lat: Number(r.lat),
      lon: Number(r.lon),
      label: [head, ...rest].join(", "),
    };
  });
}

interface NominatimReverse {
  address?: { city?: string; town?: string; village?: string; municipality?: string; suburb?: string };
}

/**
 * GPS position -> the town's name ("Pezinok"), so the start reads as a place
 * and can go into a shared plan without coordinates. One request per fix.
 */
export async function reverseTown(lat: number, lon: number, signal?: AbortSignal): Promise<string | null> {
  const url =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=sk" +
    `&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const { address: a } = (await res.json()) as NominatimReverse;
  return a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? null;
}
