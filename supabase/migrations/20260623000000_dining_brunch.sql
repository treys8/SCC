-- ============================================================================
-- SCC — Sunday brunch (singleton), the dining peer of the lunch buffet.
--
-- The club's dining week isn't uniform: the lunch buffet runs Tue–Fri, dinner
-- service is Fri/Sat only, and Sunday is brunch. The Today page now shows a
-- day-aware dining card for each. Dinner is derived (its hours live in
-- reservation_settings, and Fri/Sat = reservations required), so it needs no
-- storage. Brunch is staff-editable content, so it gets its own row — mirroring
-- dining_buffet exactly (title/hours/location/price/blurb/walk-in/active).
--
-- A parallel singleton (rather than re-keying the heavily-wired dining_buffet)
-- keeps the change low-risk and matches the codebase's singleton style. RLS
-- mirrors dining_buffet: every authenticated member reads; only staff/admin
-- write. Seeded here, only ever updated from the app. Idempotent.
-- ============================================================================

create table if not exists public.dining_brunch (
  -- Singleton: a boolean PK that can only be true caps the table at one row.
  id          boolean primary key default true check (id),
  title       text not null default 'Sunday Brunch',
  start_time  time,
  end_time    time,
  location    text,
  price       text,
  description text,
  walk_in     boolean not null default true,
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

-- Seed the one row with sensible starter copy (staff edit it under /manage/dining).
insert into public.dining_brunch
  (id, title, start_time, end_time, location, price, description, walk_in, active)
values
  (true, 'Sunday Brunch', '10:30', '14:00', 'Main Dining Room',
   '$24 per person', 'Omelet station, carving board, pastries, and bottomless mimosas.',
   true, true)
  on conflict (id) do nothing;

drop trigger if exists update_dining_brunch_updated_at on public.dining_brunch;
create trigger update_dining_brunch_updated_at
  before update on public.dining_brunch
  for each row execute function public.update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.dining_brunch enable row level security;

grant select, update on public.dining_brunch to authenticated;

-- ---- all authenticated members read ----
drop policy if exists "dining_brunch_select_authenticated" on public.dining_brunch;
create policy "dining_brunch_select_authenticated"
  on public.dining_brunch for select to authenticated using (true);

-- ---- staff/admin update (the single row is seeded, so update is the only write) ----
drop policy if exists "dining_brunch_update_staff_admin" on public.dining_brunch;
create policy "dining_brunch_update_staff_admin"
  on public.dining_brunch for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );
