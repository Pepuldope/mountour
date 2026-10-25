// English for a trip's generated description (pipeline/trips.py _describe), e.g.
// "Výstup na vrchol Baba (536 m). Štart: Podbabská dolina, späť rovnakou cestou. Po modrej a červenej značke."
// Names stay Slovak. A description written by hand doesn't match and gets null.

const FIRST: [RegExp, string][] = [
  [/^Výstup na vrchol (.+?)(?: \((\d+) m\))?\.$/, "A hike up {1}{2}."],
  [/^Výlet k vyhliadke (.+)\.$/, "A trip to the viewpoint {1}."],
  [/^Výlet k hradu: (.+)\.$/, "A trip to a castle: {1}."],
  [/^Výlet k horskej chate: (.+)\.$/, "A trip to a mountain hut: {1}."],
  [/^Výlet k plesu: (.+)\.$/, "A trip to a mountain lake: {1}."],
  [/^Výlet k vode: (.+)\.$/, "A trip to the water: {1}."],
  [/^Výlet k vodopádu: (.+)\.$/, "A trip to a waterfall: {1}."],
  [/^Výlet k jaskyni: (.+)\.$/, "A trip to a cave: {1}."],
  [/^Výlet do doliny: (.+)\.$/, "A trip into a valley: {1}."],
  [/^Výlet do rokliny: (.+)\.$/, "A trip into a gorge: {1}."],
  [/^Výlet: (.+)\.$/, "A trip: {1}."],
];

const COLOUR: Record<string, string> = { červenej: "red", modrej: "blue", zelenej: "green", žltej: "yellow" };

export function describeEn(sk: string | null | undefined): string | null {
  const m = sk ? /^(.+?\.) Štart: (.+), (okruh|späť rovnakou cestou)\.(?: Po (.+) značke\.)?$/.exec(sk) : null;
  if (!m) return null;
  let first: string | null = null;
  for (const [re, en] of FIRST) {
    const f = re.exec(m[1]);
    if (f) {
      first = en.replace("{1}", f[1]).replace("{2}", f[2] ? ` (${f[2]} m)` : "");
      break;
    }
  }
  if (!first) return null;
  const back = m[3] === "okruh" ? "a loop" : "back the same way";
  let marks = "";
  if (m[4]) {
    const cols = m[4].split(/, | a /).map((c) => COLOUR[c]);
    if (cols.some((c) => !c)) return null;
    marks = ` Follows the ${cols.length > 1 ? `${cols.slice(0, -1).join(", ")} and ${cols[cols.length - 1]}` : cols[0]} trail marking${cols.length > 1 ? "s" : ""}.`;
  }
  return `${first} Start: ${m[2]}, ${back}.${marks}`;
}
