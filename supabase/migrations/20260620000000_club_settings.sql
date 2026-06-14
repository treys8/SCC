-- ============================================================================
-- SCC — Club-wide app settings (singleton).
--
-- One row of club-level toggles, kept as a singleton the same way club_info and
-- dining_buffet are: a boolean primary key that can only be true caps the table
-- at exactly one row.
--
--   * conditions_reminder_enabled — when true, the morning cron
--     (/api/cron/conditions-reminder) nudges staff in-app + via push to refresh
--     facility conditions that have gone stale (>24h). Seeded ON so the reminder
--     helps while the habit forms; staff turn it off on /manage/conditions once
--     updating conditions is routine.
--
-- RLS mirrors club_info: every authenticated member reads (so a member client
-- could read the flag harmlessly); only staff/admin update. The single row is
-- seeded here, so update is the only write granted.
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.club_settings (
  -- Singleton: a boolean PK that can only be true caps the table at one row.
  id                          boolean primary key default true check (id),
  conditions_reminder_enabled boolean not null default true,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references public.profiles(id) on delete set null
);

insert into public.club_settings (id) values (true)
  on conflict (id) do nothing;

drop trigger if exists update_club_settings_updated_at on public.club_settings;
create trigger update_club_settings_updated_at
  before update on public.club_settings
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.club_settings enable row level security;

grant select, update on public.club_settings to authenticated;

-- ---- all authenticated members read ----
drop policy if exists "club_settings_select_authenticated" on public.club_settings;
create policy "club_settings_select_authenticated"
  on public.club_settings for select to authenticated using (true);

-- ---- staff/admin update (the single row is seeded, so update is the only write) ----
drop policy if exists "club_settings_update_staff_admin" on public.club_settings;
create policy "club_settings_update_staff_admin"
  on public.club_settings for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );
