"""Read what the trip pipeline needs from an OpenStreetMap extract (.osm.pbf or .osm).

Two passes over the file: hiking route relations first (relations come last in
the file, and we need them to know which ways are marked), then nodes and ways
with locations. A third, optional pass assembles the country border to keep
only Slovak towns and trailheads.
"""

from dataclasses import dataclass, field

import numpy as np
import osmium

WALK_HIGHWAYS = {
    "path", "footway", "track", "steps", "bridleway", "pedestrian", "cycleway", "ladder",
    "residential", "unclassified", "service", "living_street", "tertiary", "road",
}
FOOTPATHS = {"path", "footway", "track", "steps", "bridleway", "pedestrian", "cycleway", "ladder"}
SAC = {
    "hiking": 1, "mountain_hiking": 2, "demanding_mountain_hiking": 3,
    "alpine_hiking": 4, "demanding_alpine_hiking": 5, "difficult_alpine_hiking": 6,
}
KST_COLOURS = {"red": "red", "blue": "blue", "green": "green", "yellow": "yellow", "black": "black"}
NO_ACCESS = {"no", "private"}
FOOT_OK = {"yes", "designated", "permissive"}
# way tags kept for rule selectors (fee-rules.json way_tags)
WATCH_TAGS = {"highway", "ladder", "oneway", "oneway:foot"}


@dataclass
class Feature:
    osm: str
    name: str | None
    lat: float
    lon: float
    tags: dict


@dataclass
class Way:
    id: int
    nodes: np.ndarray  # OSM node ids
    lats: np.ndarray
    lons: np.ndarray
    highway: str
    sac: int
    oneway: int  # 0 both ways, 1 forward only, -1 backward only (walking)
    routes: list  # indices into OsmData.routes
    tags: frozenset  # "k=v" strings from WATCH_TAGS


@dataclass
class OsmData:
    routes: list = field(default_factory=list)  # dicts: id, ref, colour, name
    ways: list = field(default_factory=list)
    guideposts: list = field(default_factory=list)
    parking: list = field(default_factory=list)
    stops: list = field(default_factory=list)
    destinations: list = field(default_factory=list)  # (kind, Feature)
    pois: list = field(default_factory=list)  # (kind, Feature)
    towns: list = field(default_factory=list)
    probes: dict = field(default_factory=dict)  # name -> [(lat, lon)]
    border: object = None  # shapely geometry of the country, or None
    data_at: str | None = None


def kst_colour(tags):
    """Trail colour from osmc:symbol ('red:white:red_bar') or colour."""
    sym = tags.get("osmc:symbol", "")
    for part in [sym.split(":")[0], sym.split(":")[2].split("_")[0] if sym.count(":") >= 2 else ""]:
        if part in KST_COLOURS:
            return KST_COLOURS[part]
    return KST_COLOURS.get(tags.get("colour", "").lower())


def destination_kind(t):
    name = t.get("name", "")
    low = name.lower()
    if t.get("natural") == "peak":
        return "vrchol"
    if t.get("man_made") == "tower" and t.get("tower:type") == "observation":
        return "vyhliadka"
    if t.get("tourism") == "viewpoint":
        return "vyhliadka"
    if t.get("historic") == "castle" or (t.get("historic") == "ruins" and (t.get("ruins") == "castle" or "hrad" in low)):
        return "hrad"
    if t.get("tourism") == "alpine_hut":
        return "chata"
    if t.get("waterway") == "waterfall":
        return "vodopad"
    if t.get("natural") == "water" and "pleso" in low:
        return "pleso"
    if t.get("natural") == "cave_entrance" and (t.get("show_cave") == "yes" or t.get("tourism") == "attraction" or t.get("fee")):
        return "jaskyna"
    return None


def poi_kind(t):
    if t.get("tourism") == "viewpoint" or t.get("tower:type") == "observation":
        return "vyhliadka"
    if t.get("historic") in ("castle", "ruins"):
        return "hrad"
    if t.get("tourism") in ("alpine_hut", "chalet"):
        return "chata"
    if t.get("tourism") == "wilderness_hut" or t.get("amenity") == "shelter":
        return "utulna"
    if t.get("amenity") in ("restaurant", "pub", "fast_food", "cafe"):
        return "obcerstvenie"
    if t.get("natural") == "spring" or t.get("amenity") == "drinking_water":
        return "pramen"
    if t.get("leisure") == "playground":
        return "ihrisko"
    return None


def stop_mode(t):
    if t.get("railway") in ("station", "halt") and t.get("station") not in ("subway", "funicular"):
        return "vlak"
    if t.get("railway") == "tram_stop":
        return "elektricka"
    if t.get("highway") == "bus_stop" or (t.get("public_transport") == "platform" and t.get("bus") == "yes"):
        return "autobus"
    return None


def parking_ok(t):
    return (
        t.get("amenity") == "parking"
        and t.get("access") not in ("private", "no", "customers", "permit")
        and t.get("parking") not in ("garage_boxes", "carports")
    )


class _Boxes:
    def __init__(self, boxes, pad):
        self.b = [(w - pad, s - pad, e + pad, n + pad) for w, s, e, n in boxes]

    def __contains__(self, latlon):
        lat, lon = latlon
        return any(w <= lon <= e and s <= lat <= n for w, s, e, n in self.b)

    def overlaps(self, lat0, lon0, lat1, lon1):
        return any(lon0 <= e and lon1 >= w and lat0 <= n and lat1 >= s for w, s, e, n in self.b)


def load(path, boxes, probe_names=(), border_relation=14296):
    """Read everything inside `boxes` ([w,s,e,n] list), plus towns and probes anywhere."""
    data = OsmData()
    feature_box = _Boxes(boxes, 0.03)
    way_box = _Boxes(boxes, 0.05)
    probe_names = set(probe_names)

    # pass 1: hiking routes
    way_routes = {}
    for r in osmium.FileProcessor(path, osmium.osm.RELATION):
        t = r.tags
        if t.get("type") == "route" and t.get("route") in ("hiking", "foot"):
            idx = len(data.routes)
            data.routes.append(dict(id=r.id, ref=t.get("ref"), colour=kst_colour(t), name=t.get("name")))
            for m in r.members:
                if m.type == "w":
                    way_routes.setdefault(m.ref, []).append(idx)

    # pass 2: nodes and ways
    def add_feature(o, lat, lon, osm_ref):
        t = dict(o.tags)
        name = t.get("name")
        if name in probe_names:
            data.probes.setdefault(name, []).append((lat, lon))
        if t.get("place") in ("city", "town") and name and osm_ref.startswith("node"):
            data.towns.append(Feature(osm_ref, name, lat, lon, t))
            return
        if (lat, lon) not in feature_box:
            return
        f = Feature(osm_ref, name, lat, lon, t)
        if t.get("tourism") == "information" and t.get("information") == "guidepost":
            data.guideposts.append(f)
            return
        if parking_ok(t):
            data.parking.append(f)
            return
        mode = stop_mode(t)
        if mode and name:
            f.tags["_mode"] = mode
            data.stops.append(f)
            return
        if name:
            kind = destination_kind(t)
            if kind:
                data.destinations.append((kind, f))
            pk = poi_kind(t)
            if pk:
                data.pois.append((pk, f))

    fp = (
        osmium.FileProcessor(path, osmium.osm.NODE | osmium.osm.WAY)
        .with_locations()
        .with_filter(osmium.filter.EmptyTagFilter())
    )
    for o in fp:
        if o.is_node():
            add_feature(o, o.location.lat, o.location.lon, f"node/{o.id}")
            continue
        t = o.tags
        hw = t.get("highway")
        walk = hw in WALK_HIGHWAYS
        feature = hw is None and ("name" in t or t.get("amenity") == "parking")
        if not (walk or feature):
            continue
        try:
            lats = np.array([n.lat for n in o.nodes])
            lons = np.array([n.lon for n in o.nodes])
        except osmium.InvalidLocationError:
            continue
        if len(lats) == 0:
            continue
        if walk and len(lats) >= 2 and way_box.overlaps(lats.min(), lons.min(), lats.max(), lons.max()):
            access_blocked = t.get("access") in NO_ACCESS and t.get("foot") not in FOOT_OK
            if not access_blocked and t.get("foot") != "no" and t.get("area") != "yes":
                ow_tag = t.get("oneway:foot") or (t.get("oneway") if hw in FOOTPATHS else None)
                oneway = 1 if ow_tag in ("yes", "1", "true") else -1 if ow_tag == "-1" else 0
                data.ways.append(Way(
                    id=o.id,
                    nodes=np.array([n.ref for n in o.nodes], dtype=np.int64),
                    lats=lats,
                    lons=lons,
                    highway=hw,
                    sac=SAC.get(t.get("sac_scale"), 0),
                    oneway=oneway,
                    routes=way_routes.get(o.id, []),
                    tags=frozenset(f"{k}={t.get(k)}" for k in WATCH_TAGS if k in t),
                ))
        if feature:
            add_feature(o, float(lats.mean()), float(lons.mean()), f"way/{o.id}")

    if border_relation:
        data.border = _border(path, border_relation)
        if data.border is not None:
            from shapely.geometry import Point

            data.towns = [f for f in data.towns if data.border.contains(Point(f.lon, f.lat))]
    return data


def _border(path, relation_id):
    """Country polygon from the admin boundary relation, or None when it isn't in the file."""
    import shapely.wkb

    wkb = osmium.geom.WKBFactory()
    fp = (
        osmium.FileProcessor(path)
        .with_areas(osmium.filter.TagFilter(("admin_level", "2")))
        .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA))
        .with_filter(osmium.filter.IdFilter([relation_id * 2 + 1]))
    )
    for o in fp:
        if o.is_area() and not o.from_way() and o.orig_id() == relation_id:
            try:
                return shapely.wkb.loads(wkb.create_multipolygon(o), hex=True)
            except Exception:
                return None
    return None
