"""Photo matching and credit lines for the town pages (pipeline/photos.py)."""

import re

from pipeline.photos import GENERIC, credit, names_place, plain


def words(name):
    return [w for w in re.findall(r"[a-z]{4,}", plain(name)) if w not in GENERIC]


def test_a_title_must_name_the_place_not_a_stem_of_it():
    assert not names_place(words("Holý vŕšok"), "Catholic church - Važec.jpg")
    assert not names_place(words("Slop"), "Unnamed road, 919 54 Dobrá Voda, Slovakia.jpg")
    assert names_place(words("Čachtický hrad"), "Čachtický hrad 2.jpg")
    assert names_place(words("Kamzík"), "Pohľad na Kamzíka.jpg")
    assert names_place(words("Rozhľadňa na Tlstej hore"), "Rozhladna Tlsta hora.jpg")


def test_a_view_from_the_place_is_not_a_photo_of_it():
    assert not names_place(words("Tatárska lúka"), "Sitno z Tatárskej lúky.jpg")
    assert not names_place(words("Zámčisko"), "Pohľad na Modru zo Zámčiska.jpg")


def test_credit_lines_name_the_author():
    asked = {"Artist": {"value": "This image is a work by Mercy. When reusing, please credit me as: Mercy from Wikimedia Commons"}}
    assert credit(asked) == "Mercy from Wikimedia Commons"
    assert credit({"Artist": {"value": "I would appreciate being notified if you use my work outside Wikimedia. More of"}}) == ""
    assert credit({"Artist": {"value": '<a href="//commons.wikimedia.org/wiki/User:X">Jerzy Opioła</a>'}}) == "Jerzy Opioła"
    assert credit({"Attribution": {"value": "Photo: Jane Doe"}, "Artist": {"value": "jdoe"}}) == "Photo: Jane Doe"
    long = credit({"Artist": {"value": "word " * 40}})
    assert len(long) <= 101 and long.endswith("…") and not long[:-1].endswith(" ")


def test_mapillary_drops_sequences_shot_from_a_vehicle():
    from pipeline.photos import from_a_vehicle

    def shot(seq, ms, lon):
        return {"sequence": seq, "captured_at": ms, "geometry": {"coordinates": [lon, 48.0]}}

    # ~37 m in 2 s (~67 km/h) is a car; ~4 m in 5 s is someone walking.
    car = [shot("car", 1_600_000_000_000, 17.0), shot("car", 1_600_000_002_000, 17.0005)]
    walk = [shot("walk", 1_600_000_000_000, 17.0), shot("walk", 1_600_000_005_000, 17.00005)]
    assert from_a_vehicle(car + walk) == {"car"}
