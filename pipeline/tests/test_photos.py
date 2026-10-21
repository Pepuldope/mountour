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
