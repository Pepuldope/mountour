"""Trip names: say what the place is, one place per name."""

from pipeline import names
from pipeline.osm import Feature, poi_kind


def trip(slug, name, kind, lat, lon, score, region="Veľká Fatra", ele=None, curated=False):
    return dict(slug=slug, name=name, curated=curated, region_name=region, _score=score,
                destination=dict(name=name, kind=kind, location=dict(lat=lat, lon=lon), ele_m=ele))


def places(*rows):
    return names.Places([Feature(f"node/{i}", n, la, lo, {"place": k}) for i, (n, la, lo, k) in enumerate(rows)])


def test_normalize_says_what_the_place_is():
    assert names.normalize("Likava", "hrad") == "Hrad Likava"
    assert names.normalize("Čachtický hrad", "hrad") == "Čachtický hrad"
    assert names.normalize("Biely Kameň", "hrad") == "Biely Kameň"
    assert names.normalize("Čergov", "chata") == "Chata Čergov"
    assert names.normalize("Bilíkova chata", "chata") == "Bilíkova chata"
    assert names.normalize("na Choč", "vyhliadka") == "Vyhliadka na Choč"
    assert names.normalize("Na Drieňovú", "vyhliadka") == "Vyhliadka na Drieňovú"
    assert names.normalize("pod Jarabačkou", "vodopad") == "Vodopád pod Jarabačkou"
    assert names.normalize("dolný vodopád", "vodopad") == "Dolný vodopád"
    assert names.normalize("Slop", "jaskyna") == "Jaskyňa Slop"
    assert names.normalize("Kriváň", "vrchol") == "Kriváň"
    assert names.normalize("Biela skala", "vyhliadka") == "Biela skala"
    assert names.normalize("Liptovské Revúce", "vyhliadka", {"liptovske revuce"}) == "Vyhliadka Liptovské Revúce"
    assert names.normalize("Geotop, lávový prúd s doskovitou odlučnosťou", "vodopad") == "Vodopád Geotop"


def test_junk_names():
    assert names.is_junk(".") and names.is_junk("829 m"[:3]) and not names.is_junk("Ostrá")


def test_foreign_names():
    assert names.is_foreign("Widok na Tatry", {})
    assert names.is_foreign("Jałowcowy Garb", {})
    assert not names.is_foreign("Jałowcowy Garb", {"name:sk": "Borievkový hrb"})
    assert not names.is_foreign("Ťatliakova chata", {})
    assert not names.is_foreign("Erdödyho kopec", {})
    assert names.is_foreign("Korom-tetö", {})


def test_shared_names_get_the_village():
    p = places(("Štrbské Pleso", 49.12, 20.06, "village"), ("Ludrová", 49.03, 19.32, "village"))
    trips = [trip("krivan-ludrova", "Kriváň", "vrchol", 49.0105, 19.3432, 20, ele=1238),
             trip("krivan", "Kriváň", "vrchol", 49.1628, 20.0000, 95, region="Tatry", ele=2494)]
    kept, rep = names.tidy(trips, p)
    by = {t["slug"]: t["name"] for t in kept}
    assert by == {"krivan": "Kriváň", "krivan-ludrova": "Kriváň (Ludrová)"}
    assert not names.problems(kept)


def test_same_place_mapped_twice_is_one_trip():
    trips = [trip("zamostska-hola", "Zámostská hoľa", "vrchol", 48.90, 19.30, 50),
             trip("zamostska-hola-2", "Zámostská hoľa", "vrchol", 48.905, 19.30, 30),
             trip("sitno", "Sitno", "vrchol", 48.40, 18.88, 60),
             trip("sitno-hrad", "Sitno", "hrad", 48.405, 18.88, 40)]
    kept, rep = names.tidy(trips, places())
    assert {t["slug"] for t in kept} == {"zamostska-hola", "sitno", "sitno-hrad"}
    assert {t["name"] for t in kept} == {"Zámostská hoľa", "Sitno", "Hrad Sitno"}
    assert rep["merged"][0][1] == "zamostska-hola-2"


def test_hill_named_like_a_far_village():
    p = places(("Zázrivá", 49.27, 19.17, "village"), ("Turany", 49.12, 18.90, "village"))
    kept, _ = names.tidy([trip("zazriva", "Zázrivá", "vrchol", 49.1048, 18.8189, 23)], p)
    assert kept[0]["name"] == "Zázrivá (Turany)"


def test_curated_names_stay():
    trips = [trip("kamzik", "Kamzík zo Železnej studničky", "ine", 48.18, 17.09, 60, curated=True)]
    kept, _ = names.tidy(trips, places())
    assert kept[0]["name"] == "Kamzík zo Železnej studničky"


def test_problems_flag_shared_names():
    t = [dict(slug="a", name="Skalka"), dict(slug="b", name="Skalka"), dict(slug="c", name="na Choč")]
    found = names.problems(t)
    assert [s for s, _ in found] == ["error", "warn"]


def test_ruins_are_not_a_castle():
    assert poi_kind({"historic": "ruins", "name": "Bunker"}) is None
    assert poi_kind({"historic": "ruins", "ruins": "castle", "name": "Zniev"}) == "hrad"
    assert poi_kind({"historic": "castle", "name": "Likava"}) == "hrad"


def test_gorges_and_known_sights_are_goals():
    from pipeline.osm import destination_kind
    assert destination_kind({"name": "Suchá Belá", "natural": "valley", "wikidata": "Q1", "_len_m": 3500}) == "roklina"
    assert destination_kind({"name": "Vrátna dolina", "natural": "valley", "wikidata": "Q2", "_len_m": 9000}) is None
    assert destination_kind({"name": "Prielom Hornádu", "natural": "valley", "wikidata": "Q3", "_len_m": 15000}) == "roklina"
    assert destination_kind({"name": "Kotlina pod Prielomom", "natural": "valley", "wikidata": "Q4", "_len_m": 600}) is None
    assert destination_kind({"name": "Jánošíkove Diery", "tourism": "attraction", "wikidata": "Q5"}) == "roklina"
    assert destination_kind({"name": "Kláštorisko", "tourism": "attraction", "wikidata": "Q6"}) == "ine"
    assert destination_kind({"name": "Prielom", "natural": "saddle", "wikidata": "Q7"}) is None
    assert destination_kind({"name": "Jánošíkov stôl", "natural": "rock"}) is None
    assert names.normalize("Suchá Belá", "roklina") == "Roklina Suchá Belá"
    assert names.normalize("Sokolia dolina", "roklina") == "Sokolia dolina"
    assert names.normalize("Jánošíkove Diery", "roklina") == "Jánošíkove Diery"


def test_gorges_do_not_hide_other_goals():
    from pipeline.trips import _same_goal
    assert _same_goal("vrchol", "vyhliadka") and _same_goal("roklina", "roklina")
    assert not _same_goal("roklina", "vodopad") and not _same_goal("vrchol", "roklina")
