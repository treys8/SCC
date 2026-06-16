-- ============================================================================
-- SCC — Weekly buffet menu: a reusable dish catalog + a recurring weekday plan.
--
-- The lunch buffet shipped as a single `dining_buffet` row the chef overwrote
-- each morning, so the Today card could never reflect a Tue–Fri plan. This
-- migration adds a recurring weekday schedule backed by a reusable dish catalog:
--
--   1. dishes — the catalog the chef picks from. Each row is one dish, tagged
--      `main` or `side`. Soft-deactivated (active=false) rather than deleted so
--      a dish still referenced by the schedule survives. A unique index on
--      (lower(name), kind) lets the "paste a list" bulk-add de-dupe via
--      `on conflict do nothing`.
--
--   2. buffet_week — the recurring plan, max 7 rows keyed by ISO weekday
--      (1=Mon … 7=Sun): the day's main dish, an optional note, and an
--      `is_closed` flag for days with no buffet. Seeded Tue–Fri open, the rest
--      closed, matching the Blue Plate mental model.
--
--   3. buffet_week_sides — the sides for a day (a day has many sides), ordered
--      by `position`.
--
-- The existing `dining_buffet` singleton stays as the shared header members
-- already see (title, hours, location, price, walk-in, active); these tables
-- only add the day's main + sides + note.
--
-- RLS mirrors dining_buffet / documents: every authenticated member reads;
-- only staff/admin write. Idempotent: safe to run more than once.
-- ============================================================================

-- ── 1. Dish catalog ──────────────────────────────────────────────────────────
create table if not exists public.dishes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text not null check (kind in ('main', 'side')),
  active     boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- One dish per (name, kind), case-insensitive — lets bulk-add skip duplicates.
create unique index if not exists dishes_name_kind_uniq
  on public.dishes (lower(name), kind);

alter table public.dishes enable row level security;

grant select, insert, update on public.dishes to authenticated;

drop policy if exists "dishes_select_authenticated" on public.dishes;
create policy "dishes_select_authenticated"
  on public.dishes for select to authenticated using (true);

drop policy if exists "dishes_insert_staff_admin" on public.dishes;
create policy "dishes_insert_staff_admin"
  on public.dishes for insert to authenticated
  with check (
    private.current_user_role() in ('staff', 'admin')
    and created_by = (select auth.uid())
  );

drop policy if exists "dishes_update_staff_admin" on public.dishes;
create policy "dishes_update_staff_admin"
  on public.dishes for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );

-- ── 2. Recurring weekday plan (one row per ISO weekday, 1=Mon … 7=Sun) ────────
create table if not exists public.buffet_week (
  weekday      smallint primary key check (weekday between 1 and 7),
  main_dish_id uuid references public.dishes(id) on delete set null,
  note         text,
  is_closed    boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null
);

-- Seed all seven days: Tue–Fri open, Mon/Sat/Sun closed (no main yet).
insert into public.buffet_week (weekday, is_closed)
values (1, true), (2, false), (3, false), (4, false), (5, false), (6, true), (7, true)
on conflict (weekday) do nothing;

drop trigger if exists update_buffet_week_updated_at on public.buffet_week;
create trigger update_buffet_week_updated_at
  before update on public.buffet_week
  for each row execute function public.update_updated_at_column();

alter table public.buffet_week enable row level security;

grant select, update on public.buffet_week to authenticated;

drop policy if exists "buffet_week_select_authenticated" on public.buffet_week;
create policy "buffet_week_select_authenticated"
  on public.buffet_week for select to authenticated using (true);

-- The seven rows are seeded, so update is the only write path.
drop policy if exists "buffet_week_update_staff_admin" on public.buffet_week;
create policy "buffet_week_update_staff_admin"
  on public.buffet_week for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );

-- ── 3. Sides for a day ───────────────────────────────────────────────────────
create table if not exists public.buffet_week_sides (
  weekday  smallint not null references public.buffet_week(weekday) on delete cascade,
  dish_id  uuid not null references public.dishes(id) on delete cascade,
  position smallint not null default 0,
  primary key (weekday, dish_id)
);
create index if not exists buffet_week_sides_weekday_idx
  on public.buffet_week_sides (weekday, position);

alter table public.buffet_week_sides enable row level security;

grant select, insert, delete on public.buffet_week_sides to authenticated;

drop policy if exists "buffet_week_sides_select_authenticated" on public.buffet_week_sides;
create policy "buffet_week_sides_select_authenticated"
  on public.buffet_week_sides for select to authenticated using (true);

drop policy if exists "buffet_week_sides_insert_staff_admin" on public.buffet_week_sides;
create policy "buffet_week_sides_insert_staff_admin"
  on public.buffet_week_sides for insert to authenticated
  with check ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "buffet_week_sides_delete_staff_admin" on public.buffet_week_sides;
create policy "buffet_week_sides_delete_staff_admin"
  on public.buffet_week_sides for delete to authenticated
  using ( private.current_user_role() in ('staff', 'admin') );
