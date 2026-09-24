-- ============================================
-- FightHub — AI worker support
-- Run once in Supabase SQL Editor, after 001_schema.sql. Safe to re-run.
-- ============================================

-- ---- Drafts ------------------------------------------------------------
-- Records created by the AI that need review carry doc.draft = true.
-- (A separate flag, because fighters already use `status` for Active/Retired.)
do $$
declare
  t text;
begin
  foreach t in array array['fighters', 'articles', 'events', 'rankings', 'gyms', 'martial_arts', 'training_plans']
  loop
    execute format($f$
      alter table public.%1$I
        add column if not exists is_draft boolean
        generated always as (coalesce((doc->>'draft')::boolean, false)) stored$f$, t);

    execute format('drop policy if exists "Public can read published" on public.%1$I', t);
    execute format('create policy "Public can read published" on public.%1$I
                    for select to anon, authenticated
                    using (status is distinct from %2$L and not is_draft)', t, 'draft');
  end loop;
end
$$;

-- ---- AI activity log -------------------------------------------------------
-- One row per worker run, shown on the admin dashboard.
create table if not exists public.ai_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  summary jsonb not null default '{}'::jsonb,
  log text not null default ''
);

alter table public.ai_runs enable row level security;

drop policy if exists "Admins can read AI runs" on public.ai_runs;
create policy "Admins can read AI runs" on public.ai_runs
  for select to authenticated using ((select public.is_admin()));

grant select on public.ai_runs to authenticated;
