"""Trip names people can trust: each name says what the place is, and no two places share one.

OpenStreetMap names a castle after its village ("Likava"), a hut after its hill ("Čergov"),
a viewpoint after the direction it faces ("na Choč"), and Slovakia has dozens of hills
called Skalka or Kriváň. tidy() runs on the main trips of each weekly build:

1. names get the word for what the place is when the name alone does not say it
   ("Hrad Likava", "Chata Čergov", "Vyhliadka na Choč");
2. the same place mapped twice (two "Zámostská hoľa" points 600 m apart, a viewpoint named
   after the peak it stands on) becomes one trip, the better known one;
3. places that still share a name keep it plain for the best known one, the others get the
   nearest village in brackets: "Kriváň" in the Tatras, "Kriváň (Ludrová)" in Veľká Fatra.

    python -m pipeline.names --check public/data/trips/list.json

lists what is still wrong with the published names and fails when two places share a name.
"""

import argparse
import json
import re
import sys
import unicodedata

from .geo import haversine

KIND_WORD = {"hrad": "Hrad", "chata": "Chata", "jaskyna": "Jaskyňa", "vodopad": "Vodopád", "pleso": "Pleso",
             "vyhliadka": "Vyhliadka"}
# A name holding one of these already says what the place is.
KIND_HINTS = {
    "hrad": ("hrad", "hrád", "zámok", "zámoč", "kaštieľ", "kameň", "zrúcanin", "vár"),
    "chata": ("chat", "útuln", "útulň", "búd", "horáre", "ubytov", "hotel", "bivak", "salaš", "kolib", "chalup",
              "penzi", "hostin", "bacówk", "chyž", "dom"),
    "jaskyna": ("jaskyň", "jaskyn", "diera", "ľadnic", "priepas", "ponor", "vchod"),
    "vodopad": ("vodop", "kaskád", "ľadopád"),
    "pleso": ("pleso", "jazer", "tajch", "mlák"),
}
# Kinds that are a different thing from a hill even under the same name (Sitno the hill, Sitno the castle).
DISTINCT = {"hrad", "chata", "jaskyna", "pleso", "vodopad"}
PREPOSITIONS = {"na", "nad", "pod", "pred", "za", "z", "zo", "pri", "k", "ku", "v", "vo", "od", "do", "medzi",
                "ponad", "popod", "spod", "sponad"}
# Polish, Hungarian and German letters Slovak does not use: a name from across the border.
FOREIGN_LETTERS = set("łśćńźżęąőűöü")
FOREIGN_WORDS = {"widok", "schronisko", "przełęcz", "szczyt", "kilátó", "aussicht"}
SAME_PLACE_M = 1500  # the same name this close is the same place mapped twice
VILLAGE_M = 12000
WELL_KNOWN = 40  # a score this high means a Wikipedia article: people know the hill by its plain name
VILLAGES = ("village", "town", "city")


def fold(name):
    """Compare names without case, accents or spacing: 'Žiarske Pleso' == 'žiarske pleso'."""
    t = unicodedata.normalize("NFKD", (name or "").lower())
    return re.sub(r"\s+", " ", "".join(c for c in t if not unicodedata.combining(c))).strip()


def is_junk(name):
    """No real name: ".", "829", "A-1"."""
    return not re.search(r"[^\W\d_]{2}", name or "")


def is_foreign(name, tags):
    """A name in Polish, Hungarian or German with no Slovak name beside it."""
    if tags.get("name:sk") or not name:
        return False
    low = name.lower()
    return bool(set(low) & FOREIGN_LETTERS) or low.split()[0] in FOREIGN_WORDS


def normalize(name, kind, place_names=frozenset()):
    """The name to show for a place of this kind ('Likava', 'hrad' -> 'Hrad Likava')."""
    n = re.sub(r"\s+", " ", (name or "").strip())
    if not n:
        return n
    if len(n) > 32 and ", " in n:  # "Geotop, lávový prúd s doskovitou odlučnosťou"
        n = n.split(", ")[0]
    word = KIND_WORD.get(kind)
    first = n.split()[0].lower()
    if word and first in PREPOSITIONS:
        n = f"{word} {n[0].lower()}{n[1:]}"  # "na Choč" -> "Vyhliadka na Choč"
    elif kind in KIND_HINTS and not any(h in n.lower() for h in KIND_HINTS[kind]):
        n = f"{word} {n}"  # "Likava" -> "Hrad Likava"
    elif word and fold(n) in place_names:
        n = f"{word} {n}"  # a viewpoint called "Liptovské Revúce" is not the village
    return n[0].upper() + n[1:]


class Places:
    """Villages and towns, for the bracket after a shared name."""

    def __init__(self, features):
        self.items = [(f.name, f.lat, f.lon, f.tags.get("place")) for f in features if f.name]
        self.names = frozenset(fold(n) for n, _, _, _ in self.items)

    def nearest(self, lat, lon, avoid=""):
        best = None
        for name, la, lo, kind in self.items:
            if fold(name) == fold(avoid):
                continue
            d = haversine(lat, lon, la, lo)
            # a village or town before a hamlet or a part of a town, unless the hamlet is much closer
            score = d if kind in VILLAGES else d * 2.5
            if d <= VILLAGE_M and (best is None or score < best[0]):
                best = (score, name)
        return best[1] if best else None

    def far_namesake(self, name, lat, lon):
        """A village of the same name somewhere else (a hill 'Zázrivá' 30 km from Zázrivá)."""
        f = fold(name)
        return any(fold(n) == f and kind in VILLAGES and haversine(lat, lon, la, lo) > 5000
                   for n, la, lo, kind in self.items)


def _loc(t):
    return t["destination"]["location"]["lat"], t["destination"]["location"]["lon"]


def tidy(trips, places, score=lambda t: t.get("_score", 0)):
    """Rename, merge and tell apart the main trips (in place). Returns (kept trips, report)."""
    rep = dict(renamed=[], merged=[], told_apart=[])
    for t in trips:
        if t.get("curated"):
            continue
        new = normalize(t["destination"]["name"], t["destination"]["kind"], places.names)
        if new != t["name"]:
            rep["renamed"].append((t["name"], new, t["slug"]))
            t["name"] = new

    kept = []
    for t in sorted(trips, key=lambda t: (not t.get("curated"), -score(t))):
        twin = None if t.get("curated") else next((k for k in kept if _same_place(k, t)), None)
        if twin:
            rep["merged"].append((t["name"], t["slug"], twin["name"], twin["slug"],
                                  round(haversine(*_loc(t), *_loc(twin)))))
            continue
        kept.append(t)

    groups = {}
    for t in kept:
        groups.setdefault(fold(t["name"]), []).append(t)
    taken = set(groups)
    for key, group in groups.items():
        lat, lon = _loc(group[0])
        lone_namesake = (len(group) == 1 and not group[0].get("curated")
                         and group[0]["destination"]["kind"] == "vrchol" and score(group[0]) < WELL_KNOWN
                         and places.far_namesake(group[0]["name"], lat, lon))
        if len(group) == 1 and not lone_namesake:
            continue
        # the best known keeps the plain name; a hill named like a far village never does
        rest = group if lone_namesake else group[1:]
        for t in rest:
            if t.get("curated"):
                continue
            base = t["name"]
            village = places.nearest(*_loc(t), avoid=base)
            options = [f"{base} ({village})"] if village else []
            options += [f"{base} ({t['region_name']})"]
            if t["destination"].get("ele_m"):
                options += [f"{base} ({village or t['region_name']}, {t['destination']['ele_m']} m)"]
            new = next((o for o in options if fold(o) not in taken), f"{base} ({t['slug']})")
            taken.add(fold(new))
            rep["told_apart"].append((base, new, t["slug"]))
            t["name"] = new
    return kept, rep


def _same_place(a, b):
    """One place mapped twice: the same name close by, unless one is a castle or hut and the other a hill."""
    ka, kb = a["destination"]["kind"], b["destination"]["kind"]
    if ka != kb and (ka in DISTINCT or kb in DISTINCT):
        return False
    if fold(a["destination"]["name"]) != fold(b["destination"]["name"]):
        return False
    return haversine(*_loc(a), *_loc(b)) < SAME_PLACE_M


def problems(trips):
    """What is still wrong with published names: [(severity, text)]. 'error' blocks publishing."""
    out = []
    mains = [t for t in trips if not t.get("variant_of")]
    seen = {}
    for t in mains:
        seen.setdefault(fold(t["name"]), []).append(t["slug"])
    for slugs in seen.values():
        if len(slugs) > 1:
            out.append(("error", f"same name for {len(slugs)} places: {', '.join(slugs)}"))
    for t in mains:
        n = t["name"]
        if is_junk(n):
            out.append(("error", f"{t['slug']}: no real name: {n!r}"))
        elif not n[0].isupper() and not n[0].isdigit():
            out.append(("warn", f"{t['slug']}: name starts in lower case: {n!r}"))
        elif set(n.lower()) & FOREIGN_LETTERS or n.lower().split()[0] in FOREIGN_WORDS:
            out.append(("warn", f"{t['slug']}: name looks foreign: {n!r}"))
        elif len(n) > 45:
            out.append(("warn", f"{t['slug']}: long name: {n!r}"))
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", required=True, help="public/data/trips/list.json")
    a = ap.parse_args(argv)
    found = problems(json.load(open(a.check))["trips"])
    for sev, text in found:
        print(f"{sev}: {text}")
    errors = sum(1 for s, _ in found if s == "error")
    print(f"{errors} errors, {len(found) - errors} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
