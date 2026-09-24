-- ============================================
-- FightHub — club directory search ("clubs near me")
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================

-- Coordinates as real columns so they can be indexed and searched by distance
alter table public.gyms
  add column if not exists lat double precision generated always as ((doc->>'lat')::double precision) stored,
  add column if not exists lng double precision generated always as ((doc->>'lng')::double precision) stored;

create index if not exists gyms_lat_lng_idx on public.gyms (lat, lng);

-- Nearest clubs to a point, optionally filtered by style (e.g. 'Boxing').
-- Runs with the caller's rights, so row level security still applies.
create or replace function public.gyms_near(p_lat double precision, p_lng double precision, p_km double precision default 25, p_style text default null, p_limit int default 150)
returns table (id text, doc jsonb, distance_km double precision)
language sql
stable
set search_path = ''
as $$
  select g.id, g.doc, d.km
  from public.gyms g
  cross join lateral (
    select 6371 * 2 * asin(sqrt(
      power(sin(radians(g.lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(g.lat)) * power(sin(radians(g.lng - p_lng) / 2), 2)
    )) as km
  ) d
  where g.lat between p_lat - p_km / 111.0 and p_lat + p_km / 111.0
    and g.lng between p_lng - p_km / (111.0 * greatest(cos(radians(p_lat)), 0.01))
                  and p_lng + p_km / (111.0 * greatest(cos(radians(p_lat)), 0.01))
    and d.km <= p_km
    and not g.is_draft
    and (p_style is null or g.doc->'styles' ? p_style)
  order by coalesce((g.doc->>'featured')::boolean, false) desc, d.km
  limit least(p_limit, 300);
$$;

grant execute on function public.gyms_near(double precision, double precision, double precision, text, int) to anon, authenticated;
