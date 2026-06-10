-- ============================================================================
-- SCC Phase 6 — Member department preferences.
--
-- Lets a member opt into the departments they want alerts from (golf, dining,
-- pool, …). This is the targeting layer for Phase 7 push: a golf frost delay
-- notifies members who opted into 'golf', a pool closure notifies 'pool', etc.
-- (Safety alerts — lightning holds, closures — ignore preferences and reach
-- everyone; that override lives in the app, not here.)
--
-- Modeled as a membership/join table — one row per (member, department) opted
-- into — rather than an array column, so the push fan-out can index a simple
--   select user_id where department = 'golf'
-- query. The composite primary key doubles as the dedupe guard, so re-opting
-- is an idempotent `on conflict do nothing`.
--
-- `department_type` is the existing enum (all 8 values present as of
-- 20260607120000_feed_department_categories.sql), so no enum change is needed.
--
-- RLS: members read and write only their own rows (a toggle is an insert or a
-- delete; there is no update). The Phase 7 fan-out reads across all members via
-- the service-role client, which bypasses RLS — members never read each other.
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.member_department_preferences (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  department  public.department_type not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, department)
);

-- Fan-out targeting reads "all user_ids opted into department X".
create index if not exists member_department_preferences_department_idx
  on public.member_department_preferences (department);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.member_department_preferences enable row level security;

grant select, insert, delete on public.member_department_preferences to authenticated;

-- ---- members read only their own preferences ----
drop policy if exists "mdp_select_own" on public.member_department_preferences;
create policy "mdp_select_own"
  on public.member_department_preferences for select to authenticated
  using ( user_id = (select auth.uid()) );

-- ---- members opt in only for themselves ----
drop policy if exists "mdp_insert_own" on public.member_department_preferences;
create policy "mdp_insert_own"
  on public.member_department_preferences for insert to authenticated
  with check ( user_id = (select auth.uid()) );

-- ---- members opt out only their own rows ----
drop policy if exists "mdp_delete_own" on public.member_department_preferences;
create policy "mdp_delete_own"
  on public.member_department_preferences for delete to authenticated
  using ( user_id = (select auth.uid()) );
