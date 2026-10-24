import { POI_LABEL } from "@/lib/format";
import type { FoodKind, PoiKind } from "@/lib/tripSchema";

// Food places get one of three pictograms (Peter, 2026-10-24): a restaurant, a café or bar, a buffet.
// The weekly build stores which from the OSM tags (pipeline/osm.py food_kind); trips built before
// that are told apart by name, a restaurant when the name says nothing.

const RESTAURANT = /re[sš]taur|pizz|koliba|hostinec|kr[cč]ma|jed[aá]le[nň]|sala[sš]|kuchy[nň]/;
const BUFFET = /bufet|kebab|fast ?food|street ?food|lah[oô]d|grill|ob[cč]erstven|st[aá]nok|lango[sš]|hot ?dog|burger|bageta|sendvi[cč]/;
const CAFE = /caf[eé]|caff|kaviare|k[aá]vi|coffee|espresso|presso|[cč]ajov|\bbar\b|\bpub\b|piv[aáo]|vin[aá]re|cukr[aá]r/;

/** Which food pictogram a food place gets: stored by the build, else read from its name. */
export function foodKind(name: string, stored?: FoodKind | null): FoodKind {
  if (stored) return stored;
  const n = name.toLowerCase();
  if (RESTAURANT.test(n)) return "restauracia";
  if (BUFFET.test(n)) return "bufet";
  if (CAFE.test(n)) return "kaviaren";
  return "restauracia";
}

/** The pictogram for a place on the trip: its kind, or for food places the kind of food place. */
export type PoiIcon = PoiKind | FoodKind;

export function poiIcon(p: { kind: PoiKind; name: string; food?: FoodKind | null }): PoiIcon {
  return p.kind === "obcerstvenie" ? foodKind(p.name, p.food) : p.kind;
}

/** What a food place is called on its pin and in the list. */
export const FOOD_LABEL: Record<FoodKind, string> = {
  restauracia: "Reštaurácia",
  kaviaren: "Kaviareň, bar",
  bufet: "Bufet",
};

/** A place's label: its kind, or for food places the kind of food place. */
export function poiLabel(p: { kind: PoiKind; name: string; food?: FoodKind | null }): string {
  const icon = poiIcon(p);
  return icon in FOOD_LABEL ? FOOD_LABEL[icon as FoodKind] : POI_LABEL[p.kind];
}
