-- MounTour initial schema
-- Day-hike trip planner: trail chain (start -> park -> trail -> back before dark).
-- Deliberately does NOT include: parking price/capacity, multi-day trips,
-- accommodation, community features, personal records, user-drawn routes.

create extension if not exists postgis;

create type difficulty as enum ('lahka', 'stredna', 'tazka');
create type closure_kind as enum ('rocna', 'jednorazova');
create type poi_kind as enum ('vyhliadka', 'chata', 'obcerstvenie', 'pramen', 'hrad', 'ihrisko', 'utulna');

create table trail (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  distance_m integer not null,
  ascent_m integer not null,
  difficulty difficulty not null,
  duration_min integer not null,
  family_friendly boolean not null default false,
  gpx_path text, -- Supabase Storage path to the GPX file
  bbox geography(polygon, 4326),
  created_at timestamptz not null default now()
);

create table trailhead (
  id uuid primary key default gen_random_uuid(),
  trail_id uuid not null references trail (id) on delete cascade,
  name text not null,
  location geography(point, 4326) not null,
  is_primary boolean not null default true
);

-- NOTE: location pin only. Absolutely no price or capacity columns.
create table parking_lot (
  id uuid primary key default gen_random_uuid(),
  trailhead_id uuid not null references trailhead (id) on delete cascade,
  name text not null,
  location geography(point, 4326) not null,
  surface_type text,
  note text,
  verified_on date
);

-- kind = 'rocna': recurring annual range (e.g. TANAP 1 Nov - 15 Jun), compared by
--   month/day only, ignoring year (a range that wraps the new year, e.g. Nov -> Jun,
--   is expected and must be handled by the app when checking "is closed today").
-- kind = 'jednorazova': one-off closure with real calendar dates.
-- source_url and verified_on are NOT NULL on purpose: closure info must always be
--   attributable and dated. Never invent a closure without a real source.
create table closure (
  id uuid primary key default gen_random_uuid(),
  trail_id uuid not null references trail (id) on delete cascade,
  kind closure_kind not null,
  starts_on date not null,
  ends_on date not null,
  reason text not null,
  source_url text not null,
  verified_on date not null
);

create table poi (
  id uuid primary key default gen_random_uuid(),
  trail_id uuid references trail (id) on delete set null,
  kind poi_kind not null,
  name text not null,
  location geography(point, 4326) not null,
  note text
);

create index trail_bbox_gix on trail using gist (bbox);
create index trailhead_location_gix on trailhead using gist (location);
create index parking_lot_location_gix on parking_lot using gist (location);
create index poi_location_gix on poi using gist (location);

create index trailhead_trail_id_idx on trailhead (trail_id);
create index parking_lot_trailhead_id_idx on parking_lot (trailhead_id);
create index closure_trail_id_idx on closure (trail_id);
create index poi_trail_id_idx on poi (trail_id);
