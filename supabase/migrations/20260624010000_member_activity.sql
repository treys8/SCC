-- ============================================================================
-- SCC — member activity heartbeat, the data spine for the adoption dashboard.
--
-- The app had zero usage instrumentation. To show whether members are actually
-- using the portal (vs. the incumbent), we record a single "last seen" instant
-- per user, refreshed from the app layout on each visit. A dedicated table (not
-- a column on profiles) keeps these high-frequency writes off the profiles
-- `updated_at` trigger and out of its RLS surface.
--
-- Writes go exclusively through `touch_last_seen()` (security definer), which
-- self-throttles to at most one row-write per user per 15 minutes. Members never
-- read this table; only staff/admin do, on /manage/analytics. Idempotent.
-- ============================================================================

create table if not exists public.member_activity (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

-- Active-window counts (today / 7d / 30d) and the "most recent first" member
-- list both scan by last_seen_at.
create index if not exists member_activity_last_seen_idx
  on public.member_activity (last_seen_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.member_activity enable row level security;

-- Reads only — writes happen via the definer RPC below, never directly.
grant select on public.member_activity to authenticated;

-- ---- staff/admin read all activity (the analytics dashboard) ----
drop policy if exists "member_activity_select_staff_admin" on public.member_activity;
create policy "member_activity_select_staff_admin"
  on public.member_activity for select to authenticated
  using ( private.current_user_role() in ('staff', 'admin') );

-- ── Heartbeat RPC ─────────────────────────────────────────────────────────────
-- Upsert the caller's last_seen_at, but only actually rewrite the row when it's
-- gone stale (>15 min). The layout calls this on every page load, so the WHERE
-- guard keeps it a cheap no-op for an actively-browsing member. Security definer
-- (search_path locked) so it works without granting members write access.
create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  insert into public.member_activity as ma (user_id, last_seen_at)
  values (uid, now())
  on conflict (user_id) do update
    set last_seen_at = now()
    where ma.last_seen_at < now() - interval '15 minutes';
end;
$$;

revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
