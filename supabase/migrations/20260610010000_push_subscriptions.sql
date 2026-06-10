-- ============================================================================
-- SCC Phase 7 — Web Push subscriptions.
--
-- One row per browser/device push endpoint a member has enabled. The app sends
-- Web Push (VAPID) to these endpoints when a facility status changes or a
-- reservation is confirmed/declined. Targeting reads member_department_
-- preferences (Phase 6); safety alerts reach everyone.
--
--   * endpoint        — the push service URL; globally unique. A browser hands
--                       back the same endpoint on re-subscribe, so we upsert on
--                       it (re-binding user_id covers a shared device).
--   * p256dh / auth   — the subscription's encryption keys (from
--                       PushSubscription.toJSON().keys), needed to encrypt the
--                       payload.
--   * user_agent      — best-effort label so a member could prune old devices.
--
-- RLS: a member manages only their own rows. Dead endpoints (HTTP 404/410) are
-- pruned by the send pipeline via the service-role client, which bypasses RLS.
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ---- members read only their own subscriptions ----
drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own"
  on public.push_subscriptions for select to authenticated
  using ( user_id = (select auth.uid()) );

-- ---- members register only their own subscriptions ----
drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own"
  on public.push_subscriptions for insert to authenticated
  with check ( user_id = (select auth.uid()) );

-- ---- members re-bind only their own subscriptions (upsert on endpoint) ----
drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own"
  on public.push_subscriptions for update to authenticated
  using      ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- ---- members remove only their own subscriptions ----
drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own"
  on public.push_subscriptions for delete to authenticated
  using ( user_id = (select auth.uid()) );
