-- The anon/publishable key ships to every browser, so without RLS anyone could
-- write to these tables. Enable RLS everywhere and grant read-only access.
-- Writes go through the Supabase dashboard / service role only.

alter table trail       enable row level security;
alter table trailhead   enable row level security;
alter table parking_lot enable row level security;
alter table closure     enable row level security;
alter table poi         enable row level security;

create policy "public read" on trail       for select to anon, authenticated using (true);
create policy "public read" on trailhead   for select to anon, authenticated using (true);
create policy "public read" on parking_lot for select to anon, authenticated using (true);
create policy "public read" on closure     for select to anon, authenticated using (true);
create policy "public read" on poi         for select to anon, authenticated using (true);
