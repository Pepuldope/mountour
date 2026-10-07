-- Seed data: one fully populated trail — Devinska Kobyla (Bratislava, Male Karpaty).
-- Coordinates are real-ish, centered around 48.18 N, 17.00 E.
-- The closure row is a `jednorazova` example that is already expired, so the UI
-- has something to render without lying about a currently-open trail.

insert into trail (id, name, slug, description, distance_m, ascent_m, difficulty, duration_min, family_friendly, gpx_path, bbox)
values (
  '11111111-1111-1111-1111-111111111111',
  'Devinska Kobyla',
  'devinska-kobyla',
  'Okruh z Devina na vrchol Devinskej Kobyly s vyhliadkou na sutok Moravy a Dunaja a na Rakusko. Kratky, ale strmsi vystup v zavere.',
  9200,
  380,
  'stredna',
  210,
  false,
  'gpx/devinska-kobyla.gpx',
  st_geogfromtext('POLYGON((16.965 48.170, 17.010 48.170, 17.010 48.200, 16.965 48.200, 16.965 48.170))')
);

insert into trailhead (id, trail_id, name, location, is_primary)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Devin - pod hradom',
  st_geogfromtext('POINT(16.9775 48.1789)'),
  true
);

insert into parking_lot (id, trailhead_id, name, location, surface_type, note, verified_on)
values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'Parkovisko Devin, ulica Slovanske nabrezie',
  st_geogfromtext('POINT(16.9781 48.1795)'),
  'spevnene',
  'Velke parkovisko pri autobusovej zastavke Devin, kratka pesia zachodza k zaciatku znacky.',
  '2026-06-01'
);

insert into poi (id, trail_id, kind, name, location, note)
values
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'vyhliadka',
    'Vyhliadka Devinska Kobyla',
    st_geogfromtext('POINT(17.0021 48.1875)'),
    'Vyhlad na sutok Moravy a Dunaja, na Rakusko a za dobrej viditelnosti az na Alpy.'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    'hrad',
    'Hrad Devin',
    st_geogfromtext('POINT(16.9769 48.1787)'),
    'Zricanina hradu pri vstupe na trasu, plateny areal, mozny start vylety.'
  );

-- Example expired one-off closure so the UI has real data to render without lying.
insert into closure (id, trail_id, kind, starts_on, ends_on, reason, source_url, verified_on)
values (
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  'jednorazova',
  '2026-03-01',
  '2026-03-15',
  'Tazba dreva v hornej casti trasy.',
  'https://www.bratislava-vidiek.sk/lesy-devin-tazba',
  '2026-02-20'
);
