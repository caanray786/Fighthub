-- ============================================
-- FightHub — database schema
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: every statement is idempotent.
-- ============================================

-- ---- Admins ----------------------------------------------------------------
-- A user can write content only if their auth user id is listed here.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

drop policy if exists "Admins can see their own row" on public.admins;
create policy "Admins can see their own row" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- security definer so policies can call it without exposing the admins table
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---- Timestamps -----------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---- Content tables -------------------------------------------------------
-- Every content table stores the full record as JSON in `doc`, so new fields
-- (e.g. from the AI pipeline) never need a schema change. Frequently filtered
-- fields are exposed as generated columns for indexing and security rules.
do $$
declare
  t text;
begin
  foreach t in array array['fighters', 'articles', 'events', 'rankings', 'gyms', 'martial_arts', 'training_plans']
  loop
    execute format($f$
      create table if not exists public.%1$I (
        id text primary key,
        doc jsonb not null,
        status text generated always as (doc->>'status') stored,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )$f$, t);

    execute format('alter table public.%1$I enable row level security', t);
    execute format('create index if not exists %1$s_status_idx on public.%1$I (status)', t);

    execute format('drop trigger if exists touch_updated_at on public.%1$I', t);
    execute format('create trigger touch_updated_at before update on public.%1$I
                    for each row execute function public.touch_updated_at()', t);

    -- Visitors see everything except drafts (the AI review queue in Phase 2)
    execute format('drop policy if exists "Public can read published" on public.%1$I', t);
    execute format('create policy "Public can read published" on public.%1$I
                    for select to anon, authenticated
                    using (status is distinct from %2$L)', t, 'draft');

    -- Admins can read drafts and change anything
    execute format('drop policy if exists "Admins can read all" on public.%1$I', t);
    execute format('create policy "Admins can read all" on public.%1$I
                    for select to authenticated using ((select public.is_admin()))', t);

    execute format('drop policy if exists "Admins can insert" on public.%1$I', t);
    execute format('create policy "Admins can insert" on public.%1$I
                    for insert to authenticated with check ((select public.is_admin()))', t);

    execute format('drop policy if exists "Admins can update" on public.%1$I', t);
    execute format('create policy "Admins can update" on public.%1$I
                    for update to authenticated
                    using ((select public.is_admin())) with check ((select public.is_admin()))', t);

    execute format('drop policy if exists "Admins can delete" on public.%1$I', t);
    execute format('create policy "Admins can delete" on public.%1$I
                    for delete to authenticated using ((select public.is_admin()))', t);

    -- Row Level Security above decides what each role can actually do
    execute format('grant select on public.%1$I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%1$I to authenticated', t);
  end loop;
end
$$;

-- Events are listed by date
create index if not exists events_date_idx on public.events ((doc->>'date'));
