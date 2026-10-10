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
