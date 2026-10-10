-- Visit days: one row per (visitor, day). `visitor` is a one-way hash of
-- IP + browser with a secret key that changes every month (app/api/visit),
-- so a row can't be tied to a person and months can't be linked.
-- Proposal KPI: "people who used MounTour on 4+ different days in a month".

create table if not exists visit_day (
  visitor text not null,
  day     date not null,
  primary key (visitor, day)
);

-- Only the server (secret / service_role key) may read or write. No policies
-- are created, so the public anon key gets nothing.
alter table visit_day enable row level security;
revoke all on visit_day from anon, authenticated;

-- The monthly report. Open it in Supabase → Table Editor → monthly_visitors.
create or replace view monthly_visitors with (security_invoker = true) as
with per_visitor as (
  select to_char(day, 'YYYY-MM') as month, visitor, count(*) as days
  from visit_day
  group by 1, 2
)
select
  month,
  count(*)                                  as visitors,
  count(*) filter (where days >= 2)         as visitors_2plus_days,
  count(*) filter (where days >= 4)         as visitors_4plus_days,
  round(avg(days), 2)                       as avg_days
from per_visitor
group by month
order by month desc;

revoke all on monthly_visitors from anon, authenticated;

-- Keep raw rows 14 months, then delete them (promised in /sukromie).
-- Monthly totals stay in monthly_visitors_archive.
create table if not exists monthly_visitors_archive (
  month               text primary key,
  visitors            bigint not null,
  visitors_2plus_days bigint not null,
  visitors_4plus_days bigint not null,
  avg_days            numeric not null,
  archived_at         timestamptz not null default now()
);
alter table monthly_visitors_archive enable row level security;
revoke all on monthly_visitors_archive from anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- 03:00 UTC on the 2nd of every month: copy finished months into the archive,
-- then drop raw rows older than 14 months.
select cron.schedule(
  'mountour-visit-days-cleanup',
  '0 3 2 * *',
  $$
    insert into monthly_visitors_archive (month, visitors, visitors_2plus_days, visitors_4plus_days, avg_days)
    select month, visitors, visitors_2plus_days, visitors_4plus_days, avg_days
    from monthly_visitors
    where month < to_char(now(), 'YYYY-MM')
    on conflict (month) do update set
      visitors = excluded.visitors,
      visitors_2plus_days = excluded.visitors_2plus_days,
      visitors_4plus_days = excluded.visitors_4plus_days,
      avg_days = excluded.avg_days,
      archived_at = now();
    delete from visit_day where day < (now() - interval '14 months')::date;
  $$
);
