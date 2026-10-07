-- Nearest parking first (was alphabetical, which put "280 m" before "71 m").

create or replace view trail_detail with (security_invoker = on) as
select
  t.slug,
  jsonb_build_object(
    'trail', jsonb_build_object(
      'id', t.id, 'name', t.name, 'slug', t.slug, 'description', t.description,
      'distance_m', t.distance_m, 'ascent_m', t.ascent_m, 'difficulty', t.difficulty,
      'duration_min', t.duration_min, 'family_friendly', t.family_friendly,
      'gpx_path', t.gpx_path, 'created_at', t.created_at,
      'bbox', case when t.bbox is null then null else jsonb_build_object(
        'sw', jsonb_build_object('lat', st_ymin(t.bbox::geometry), 'lon', st_xmin(t.bbox::geometry)),
        'ne', jsonb_build_object('lat', st_ymax(t.bbox::geometry), 'lon', st_xmax(t.bbox::geometry))
      ) end
    ),
    'trailheads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', th.id, 'trail_id', th.trail_id, 'name', th.name, 'is_primary', th.is_primary,
        'location', jsonb_build_object('lat', st_y(th.location::geometry), 'lon', st_x(th.location::geometry))
      ) order by th.is_primary desc, th.name)
      from trailhead th where th.trail_id = t.id
    ), '[]'::jsonb),
    'parkingLots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'trailhead_id', p.trailhead_id, 'name', p.name,
        'surface_type', p.surface_type, 'note', p.note, 'verified_on', p.verified_on,
        'location', jsonb_build_object('lat', st_y(p.location::geometry), 'lon', st_x(p.location::geometry))
      ) order by st_distance(p.location, th.location))
      from parking_lot p join trailhead th on th.id = p.trailhead_id where th.trail_id = t.id
    ), '[]'::jsonb),
    'transitStops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'trailhead_id', s.trailhead_id, 'name', s.name, 'mode', s.mode,
        'distance_m', s.distance_m,
        'location', jsonb_build_object('lat', st_y(s.location::geometry), 'lon', st_x(s.location::geometry))
      ) order by s.distance_m)
      from transit_stop s join trailhead th on th.id = s.trailhead_id where th.trail_id = t.id
    ), '[]'::jsonb),
    'closures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'trail_id', c.trail_id, 'kind', c.kind, 'starts_on', c.starts_on,
        'ends_on', c.ends_on, 'reason', c.reason, 'source_url', c.source_url,
        'verified_on', c.verified_on
      ) order by c.starts_on)
      from closure c where c.trail_id = t.id
    ), '[]'::jsonb),
    'pois', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'trail_id', o.trail_id, 'kind', o.kind, 'name', o.name, 'note', o.note,
        'location', jsonb_build_object('lat', st_y(o.location::geometry), 'lon', st_x(o.location::geometry))
      ) order by o.name)
      from poi o where o.trail_id = t.id
    ), '[]'::jsonb)
  ) as detail
from trail t;

grant select on trail_detail to anon, authenticated;
