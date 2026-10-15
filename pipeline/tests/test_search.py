"""The search index: named places by the trips, and the trips that touch them."""

from pipeline import search


def trip(slug, start, lat, lon, variant_of=None, rank=50):
    return dict(slug=slug, variant_of=variant_of, rank=rank,
                destination=dict(name="Kamzík", kind="vrchol", location=dict(lat=48.18, lon=17.09)),
                start=dict(name=start, location=dict(lat=lat, lon=lon)), parking=None, transit=None, pois=[])


def test_places_point_to_the_main_trip():
    idx = search.build([trip("kamzik", "Koliba", 48.17, 17.10),
                        trip("kamzik-zs", "Železná studnička", 48.19, 17.08, variant_of="kamzik")])
    places = {p[0]: [idx["trips"][i] for i in p[4]] for p in idx["places"]}
    assert places["Železná studnička"] == ["kamzik"]
    assert places["Kamzík"] == ["kamzik"]  # one place though both routes end there


def test_generic_names_are_left_out():
    idx = search.build([trip("a", "Parkovisko", 48.17, 17.10)])
    assert "Parkovisko" not in {p[0] for p in idx["places"]}
