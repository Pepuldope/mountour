"""Photos for the places trips lead to, from Wikimedia Commons (free licences only).

Each destination's OpenStreetMap object may carry a `wikidata` id (whose main image,
P18, is used) or a `wikimedia_commons` file. The thumbnail address, author and licence
go to public/data/photos.json, keyed by the OSM object ("node/123"). Places without a
free photo are simply left out; the site draws its own tile for them.

    python -m pipeline.photos            # reads public/data/trips/index.json
"""

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = "MounTour photos (https://github.com/Pepuldope/mountour)"
INDEX = Path("public/data/trips/index.json")
OUT = Path("public/data/photos.json")
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
    """Main image file name (P18) per Wikidata id."""
    out = {}
    qids = sorted(qids)
    for k in range(0, len(qids), 50):
        body = get_json("https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids="
                        + "|".join(qids[k : k + 50]))
        for q, e in (body or {}).get("entities", {}).items():
            for c in e.get("claims", {}).get("P18", []):
                v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
                if v:
                    out[q] = v
                    break
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
    ids = sorted({t["destination"]["osm"] for t in trips if t["destination"].get("osm")})
    log(f"{len(ids)} places")
    tags = osm_tags(ids)
    qid = {i: t["wikidata"].split(";")[0].strip() for i, t in tags.items() if re.fullmatch(r"Q\d+", t.get("wikidata", "").split(";")[0].strip())}
    p18 = wikidata_images(set(qid.values()))
    file_of = {}
    for i in ids:
        f = p18.get(qid.get(i, ""))
        c = tags.get(i, {}).get("wikimedia_commons", "")
        if not f and c.startswith("File:"):
            f = c.removeprefix("File:")
        if f:
            file_of[i] = f.replace("_", " ")
    info = commons_info(set(file_of.values()))
    photos = {i: info[f] for i, f in file_of.items() if f in info}
    OUT.write_text(json.dumps(dict(
        generated_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        source="Wikimedia Commons via Wikidata and OpenStreetMap",
        photos=dict(sorted(photos.items())),
    ), ensure_ascii=False, separators=(",", ":")) + "\n")
    log(f"tags {len(tags)}, wikidata {len(qid)}, with image {len(file_of)}, free photo {len(photos)} of {len(ids)} places")


if __name__ == "__main__":
    main()
