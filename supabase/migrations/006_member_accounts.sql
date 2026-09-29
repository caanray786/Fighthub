-- ============================================
-- FightHub — 006: member accounts (sign-in with Clerk)
-- Members sign in to the training app with Clerk. Supabase trusts Clerk's
-- session tokens (Authentication → Third-Party Auth → Clerk), and every
-- member row below is locked to the Clerk user id in the token ("sub").
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: every statement is idempotent.
-- ============================================

-- ---- Admin check that works for both kinds of login ------------------------
-- Clerk user ids look like "user_2abc…", not UUIDs, so auth.uid() (which
-- converts the id to a UUID) would raise an error for signed-in members on any
-- table whose policies call is_admin(). Compare the id as text instead.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins
    where user_id::text = (select auth.jwt() ->> 'sub')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Admins can see their own row" on public.admins;
create policy "Admins can see their own row" on public.admins
  for select to authenticated
  using (user_id::text = (select auth.jwt() ->> 'sub'));

-- The signed-in member's id (Clerk user id), or null when signed out
create or replace function public.member_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif((select auth.jwt() ->> 'sub'), '');
$$;

grant execute on function public.member_id() to anon, authenticated;

-- ---- Member profiles --------------------------------------------------------
-- What the app and the voice coach need to personalise training.
create table if not exists public.member_profiles (
  user_id      text primary key default public.member_id(),
  display_name text check (char_length(display_name) <= 60),
  gender       text check (gender in ('male', 'female', 'unspecified')),
  coach_voice  text check (coach_voice in ('male', 'female')),
  discipline   text check (char_length(discipline) <= 40),
  goal         text check (char_length(goal) <= 80),
  level        text check (level in ('Beginner', 'Intermediate', 'Advanced')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.member_profiles enable row level security;

drop trigger if exists member_profiles_touch on public.member_profiles;
create trigger member_profiles_touch before update on public.member_profiles
  for each row execute function public.touch_updated_at();

-- ---- Training journal -------------------------------------------------------
-- One row per journal entry. "deleted" rows let a deletion on one phone reach
-- the member's other devices.
create table if not exists public.journal_entries (
  user_id    text not null default public.member_id(),
  id         text not null check (char_length(id) <= 64),
  doc        jsonb not null check (pg_column_size(doc) < 8192),
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.journal_entries enable row level security;

drop trigger if exists journal_entries_touch on public.journal_entries;
create trigger journal_entries_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();

-- ---- Each member can only see and change their own rows ---------------------
-- (Admins are deliberately not given access: journals are private.)
do $$
declare
  t text;
begin
  foreach t in array array['member_profiles', 'journal_entries'] loop
    execute format('drop policy if exists "Members read own rows" on public.%1$I', t);
    execute format('create policy "Members read own rows" on public.%1$I
                    for select to authenticated using (user_id = (select public.member_id()))', t);
    execute format('drop policy if exists "Members add own rows" on public.%1$I', t);
    execute format('create policy "Members add own rows" on public.%1$I
                    for insert to authenticated with check (user_id = (select public.member_id()))', t);
    execute format('drop policy if exists "Members change own rows" on public.%1$I', t);
    execute format('create policy "Members change own rows" on public.%1$I
                    for update to authenticated
                    using (user_id = (select public.member_id()))
                    with check (user_id = (select public.member_id()))', t);
    execute format('drop policy if exists "Members delete own rows" on public.%1$I', t);
    execute format('create policy "Members delete own rows" on public.%1$I
                    for delete to authenticated using (user_id = (select public.member_id()))', t);
  end loop;
end $$;
