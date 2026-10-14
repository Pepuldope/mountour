"""One-off: how are gorges, rock towns and other sights mapped in OSM Slovakia? Prints a table to the log."""
import re
import sys
from collections import Counter

import osmium

WORDS = re.compile(r"roklin|tiesňav|diery|prielom|kaňon|soutěsk|skaly|skalné|piecky|kyseľ|suchá belá|sokolia|"
                   r"kláštorisko|kamenné more|skalné mesto|vráta|brána|okno", re.I)
NAT = {"gorge", "canyon", "valley", "rock", "cliff", "stone", "arch", "rock_formation", "bare_rock", "sinkhole"}
KEYS = ("natural", "tourism", "historic", "leisure", "highway", "route", "type", "waterway", "geological", "place",
        "landuse", "boundary", "protect_class", "wikidata", "wikipedia", "ele", "name:sk")

nat_count = Counter()
rows = []


def keep(t):
    name = t.get("name") or ""
    n = t.get("natural")
    if n:
        nat_count[(n, bool(t.get("wikidata")))] += 1
    return bool(name) and (WORDS.search(name) or n in NAT or t.get("tourism") == "attraction"
                           or t.get("geological") or (t.get("boundary") == "protected_area" and t.get("wikidata")))


def tags(t):
    return " ".join(f"{k}={t[k]}" for k in KEYS if t.get(k))


fp = osmium.FileProcessor(sys.argv[1]).with_locations().with_filter(osmium.filter.EmptyTagFilter())
for o in fp:
    t = dict(o.tags)
    if not keep(t):
        continue
    if o.is_node():
        rows.append(("n", o.id, t["name"], round(o.location.lat, 4), round(o.location.lon, 4), tags(t)))
    elif o.is_way():
        try:
            la = [n.lat for n in o.nodes]
            lo = [n.lon for n in o.nodes]
            mid = len(la) // 2
            rows.append(("w", o.id, t["name"], round(la[mid], 4), round(lo[mid], 4), f"len={len(la)} " + tags(t)))
        except osmium.InvalidLocationError:
            rows.append(("w", o.id, t["name"], 0, 0, tags(t)))
    elif o.is_relation():
        rows.append(("r", o.id, t["name"], 0, 0, f"members={len(o.members)} " + tags(t)))

print("natural counts (value, has wikidata):")
for (n, w), c in sorted(nat_count.items(), key=lambda x: -x[1])[:40]:
    print(f"  {n} {w} {c}")
interesting = [r for r in rows if not (r[5].startswith("len") and "highway=" in r[5] and "wikidata" not in r[5]
                                         and not WORDS.search(r[2]))]
print(f"{len(rows)} rows, {len(interesting)} shown")
for r in sorted(interesting, key=lambda r: ("wikidata" not in r[5], r[2])):
    print("\t".join(map(str, r)))
