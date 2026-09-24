-- ============================================
-- FightHub — worker state (progress of long-running jobs such as the fighter import)
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================

create table if not exists public.worker_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Only the worker (service role, which bypasses RLS) reads and writes this table
alter table public.worker_state enable row level security;
