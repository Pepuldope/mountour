"""Photos for the places trips lead to, from Wikimedia Commons (free licences only).

Sources, best first:
1. the OSM object's `wikidata` main image (P18) or its `wikimedia_commons` file;
2. the lead image of its Wikipedia article (OSM `wikipedia` tag or Wikidata sitelink);
3. a photo taken within 1 km whose title names the place, found by location on
   Commons, skipping guideposts, maps and boards;
4. a photo from the place's Commons category (Wikidata P373).
data/photo-overrides.json blocks files that turned out wrong and picks files by hand.
The thumbnail address, author and licence go to public/data/photos.json, keyed by
the OSM object ("node/123"), with `via` saying which source matched. Places without
a free photo are left out; the site draws its own tile for them.

    python -m pipeline.photos            # reads public/data/trips/index.json
"""

import html
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

UA = "MounTour photos (https://github.com/Pepuldope/mountour)"
INDEX = Path("public/data/trips/index.json")
OUT = Path("public/data/photos.json")
OVERRIDES = Path("data/photo-overrides.json")
# One of Wikimedia's standard thumbnail steps (others are re-rounded up to 960 px).
THUMB_W = 500
# Licences that allow use on the site with a credit line.
FREE = re.compile(r"^(cc0|cc[- ]by(-sa)?[- ]\d|public domain|pd)", re.I)


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def get_json(url):
    for wait in (0, 3, 10, 30):
        time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except Exception as e:  # one failed batch must not stop the rest
            log(f"retry {url[:90]}…: {e}")
    return None


def osm_tags(ids):
    """Tags of OSM objects ("node/1", "way/2", ...) from the OSM API, in batches."""
    out = {}
    by_type = {}
    for i in ids:
        t, n = i.split("/")
        by_type.setdefault(t, []).append(n)
    for t, nums in by_type.items():
        for k in range(0, len(nums), 150):
            batch = nums[k : k + 150]
            body = get_json(f"https://api.openstreetmap.org/api/0.6/{t}s.json?{t}s={','.join(batch)}")
            for e in (body or {}).get("elements", []):
                out[f"{e['type']}/{e['id']}"] = e.get("tags", {})
            time.sleep(1)
    return out


def wikidata_images(qids):
    """Main image file name (P18) and Commons category (P373) per Wikidata id."""
    images, cats = {}, {}
    qids = sorted(qids)
    for k in range(0, len(qids), 50):
        body = get_json("https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids="
                        + "|".join(qids[k : k + 50]))
        for q, e in (body or {}).get("entities", {}).items():
            for prop, out in (("P18", images), ("P373", cats)):
                for c in e.get("claims", {}).get(prop, []):
                    v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
                    if v:
                        out[q] = v
                        break
    return images, cats


def category_photos(cats):
    """Up to 3 photo files per Commons category, skipping guideposts, maps and boards."""
    out = {}
    for cat in sorted(cats):
        body = get_json("https://commons.wikimedia.org/w/api.php?action=query&format=json&list=categorymembers"
                        "&cmnamespace=6&cmtype=file&cmlimit=30&cmtitle=" + urllib.parse.quote("Category:" + cat))
        files = [m["title"].removeprefix("File:") for m in (body or {}).get("query", {}).get("categorymembers", [])]
        files = [f for f in files if not NOT_A_VIEW.search(f) and re.search(r"\.(jpe?g|png|webp)$", f, re.I)]
        if files:
            out[cat] = files[:3]
        time.sleep(0.1)
    return out


def wikipedia_images(titles):
    """Lead image file name per (lang, title), from Wikipedia's page images (free files only)."""
    out = {}
    by_lang = {}
    for lang, title in titles:
        by_lang.setdefault(lang, set()).add(title)
    for lang, ts in by_lang.items():
        ts = sorted(ts)
        for k in range(0, len(ts), 50):
            body = get_json(f"https://{lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1"
                            "&prop=pageimages&piprop=name&pilicense=free&titles=" + urllib.parse.quote("|".join(ts[k : k + 50])))
            q = (body or {}).get("query", {})
            back = {}
            for n in q.get("normalized", []) + q.get("redirects", []):
                back[n["to"]] = back.get(n["from"], n["from"])
            for pg in q.get("pages", {}).values():
                if pg.get("pageimage"):
                    out[(lang, back.get(pg["title"], pg["title"]))] = pg["pageimage"]
    return out


def sitelinks(qids):
    """Wikipedia article (lang, title) per Wikidata id, Slovak first."""
    out = {}
    qids = sorted(qids)
    for k in range(0, len(qids), 50):
        body = get_json("https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&format=json"
                        "&sitefilter=skwiki|cswiki|enwiki|huwiki|plwiki|dewiki&ids=" + "|".join(qids[k : k + 50]))
        for q, e in (body or {}).get("entities", {}).items():
            links = e.get("sitelinks", {})
            for site in ("skwiki", "cswiki", "enwiki", "huwiki", "plwiki", "dewiki"):
                if site in links:
                    out[q] = (site.removesuffix("wiki"), links[site]["title"])
                    break
    return out


def plain(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if not unicodedata.combining(c))


# Words that say what a place is, not which one; a title sharing only these doesn't name it.
GENERIC = set("hrad hradu zrucanina zrucaniny vrch vrchol kopec jaskyna jaskyne pleso plesa vodopad vodopady chata chaty "
              "rozhladna vyhliadka vyhlad skala skaly dolina nad pod velky velka velke maly mala male stary stara nova novy "
              "sedlo vrchy hora".split())
# Photos at the place that aren't of it.
NOT_A_VIEW = re.compile(r"rozcestn|smerovn|guidepost|signpost|\bsign|tabul|tabuľ|\bmap|mapa|plan |plán|informa|"
                        r"\bdoska|plaque|\berb\b|coat of arms|logo|\binterior|toilet|parkovisk|parking|\.svg|\.pdf|\.tif", re.I)


def near_photos(places):
    """Up to 3 Commons files taken within 1 km of each place whose title names it, nearest first."""
    out = {}
    for n, (i, name, lat, lon) in enumerate(places):
        body = get_json("https://commons.wikimedia.org/w/api.php?action=query&format=json&list=geosearch"
                        f"&gsnamespace=6&gslimit=50&gsradius=1000&gscoord={lat}|{lon}")
        words = [w for w in re.findall(r"[a-z]{4,}", plain(name)) if w not in GENERIC]
        ranked = []
        for g in (body or {}).get("query", {}).get("geosearch", []):
            title = g["title"].removeprefix("File:")
            if NOT_A_VIEW.search(title) or not re.search(r"\.(jpe?g|png|webp)$", title, re.I):
                continue
            # Only photos whose title names the place: unnamed ones nearby were often streets or signs.
            if any(w[:-1] in plain(title) for w in words):  # "Kamzíka" still names Kamzík
                ranked.append((g["dist"], title))
        if ranked:
            out[i] = [t for _, t in sorted(ranked)[:3]]
        if n % 200 == 0:
            log(f"near {n}/{len(places)}")
        time.sleep(0.1)
    return out


def strip_html(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()


def commons_info(files):
    """Thumbnail, size, author and licence per Commons file name (without "File:")."""
    out = {}
    files = sorted(files)
    for k in range(0, len(files), 50):
        titles = "|".join("File:" + f for f in files[k : k + 50])
        body = get_json("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
                        f"&iiprop=url|size|extmetadata&iiurlwidth={THUMB_W}&titles=" + urllib.parse.quote(titles))
        if not body:
            continue
        q = body.get("query", {})
        back = {n["to"]: n["from"] for n in q.get("normalized", [])}
        for p in q.get("pages", {}).values():
            ii = (p.get("imageinfo") or [None])[0]
            if not ii:
                continue
            meta = ii.get("extmetadata", {})
            lic = strip_html(meta.get("LicenseShortName", {}).get("value"))
            if not FREE.match(lic) or ii.get("width", 0) < 400:
                continue
            name = back.get(p["title"], p["title"]).removeprefix("File:")
            # Square tiles crop hard: skip panoramas and very tall shots.
            ratio = ii["width"] / max(ii["height"], 1)
            if not 0.6 <= ratio <= 2.2:
                continue
            out[name] = dict(
                url=(ii.get("thumburl") or ii["url"]).split("?")[0],
                w=ii.get("thumbwidth") or ii["width"],
                h=ii.get("thumbheight") or ii["height"],
                author=strip_html(meta.get("Artist", {}).get("value"))[:80] or "Wikimedia Commons",
                license=lic,
                page=ii.get("descriptionurl"),
            )
    return out


def main():
    trips = json.loads(INDEX.read_text())["trips"]
    # Keyed by the OSM object; hand-made trips without one by "trip/<slug>".
    dest = {t["destination"].get("osm") or f"trip/{t['slug']}": t["destination"] for t in trips}
    ids = sorted(dest)
    log(f"{len(ids)} places")
    tags = osm_tags([i for i in ids if not i.startswith("trip/")])
    qid = {i: t["wikidata"].split(";")[0].strip() for i, t in tags.items() if re.fullmatch(r"Q\d+", t.get("wikidata", "").split(";")[0].strip())}
    p18, p373 = wikidata_images(set(qid.values()))
    # Candidate files per place, best source first.
    cands = {i: [] for i in ids}
    via = {}
    for i in ids:
        f = p18.get(qid.get(i, ""))
        c = tags.get(i, {}).get("wikimedia_commons", "")
        if not f and c.startswith("File:"):
            f = c.removeprefix("File:")
        if f:
            cands[i].append((f, "wikidata"))
    article = {}
    links = sitelinks({qid[i] for i in ids if i in qid})
    for i in ids:
        w = tags.get(i, {}).get("wikipedia", "")
        if ":" in w:
            lang, title = w.split(":", 1)
            article[i] = (lang.strip(), title.strip())
        elif qid.get(i) in links:
            article[i] = links[qid[i]]
    lead = wikipedia_images(set(article.values()))
    for i, a in article.items():
        if a in lead:
            cands[i].append((lead[a], "wikipedia"))
    near = near_photos([(i, dest[i]["name"], dest[i]["location"]["lat"], dest[i]["location"]["lon"]) for i in ids])
    for i, fs in near.items():
        cands[i] += [(f, "near") for f in fs]
    in_cat = category_photos({p373[qid[i]] for i in ids if qid.get(i) in p373})
    for i in ids:
        cands[i] += [(f, "category") for f in in_cat.get(p373.get(qid.get(i, ""), ""), [])]
    # Hand fixes: a picked file goes first, blocked files are dropped.
    fix = json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {}
    blocked = {f.replace("_", " ") for f in fix.get("block", [])}
    for i, f in fix.get("pick", {}).items():
        if i in cands:
            cands[i].insert(0, (f, "picked"))
    for i in cands:
        cands[i] = [(f, src) for f, src in cands[i] if f.replace("_", " ") not in blocked]
    info = commons_info({f.replace("_", " ") for fs in cands.values() for f, _ in fs})
    photos = {}
    for i, fs in cands.items():
        for f, src in fs:
            if f.replace("_", " ") in info:
                photos[i] = dict(info[f.replace("_", " ")], via=src)
                break
    OUT.write_text(json.dumps(dict(
        generated_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        source="Wikimedia Commons via Wikidata, Wikipedia and OpenStreetMap",
        photos=dict(sorted(photos.items())),
    ), ensure_ascii=False, separators=(",", ":")) + "\n")
    counts = {s: sum(p["via"] == s for p in photos.values()) for s in ("picked", "wikidata", "wikipedia", "near", "category")}
    log(f"tags {len(tags)}, wikidata {len(qid)}, articles {len(article)}, free photo {len(photos)} of {len(ids)} places {counts}")


if __name__ == "__main__":
    main()
