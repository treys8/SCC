-- ============================================================================
-- SCC — Today page: editable course/pool conditions + the lunch buffet.
--
-- The "Today at the Club" front door shows a Course & Pool conditions grid and
-- a featured lunch buffet. Both shipped as hard-coded placeholder copy; this
-- migration moves them to real, staff-editable data.
--
--   1. facility_status.details — an ordered JSON array of {label, value} rows
--      shown under each facility's status badge (Carts / Greens / Tee sheet for
--      golf; Hours / Water / Lap lanes for pool). JSONB, not columns, because
--      the rows differ per facility and staff may add or remove them. Seeded
--      with the copy the page shipped with, so the deploy is a visual no-op.
--
--   2. dining_buffet — a single-row ("singleton") table for today's lunch
--      buffet: title, time window, location, price, blurb, walk-in flag, and an
--      `active` switch to hide the card on days with no buffet. Capped at one
--      row by a boolean primary key that can only be true.
--
-- RLS mirrors facility_status: every authenticated member reads; only
-- staff/admin write. Rows are seeded here and only ever updated from the app
-- (no insert/delete grant). Idempotent: safe to run more than once.
-- ============================================================================

-- ── 1. Conditions detail rows ───────────────────────────────────────────────
alter table public.facility_status
  add column if not exists details jsonb not null default '[]'::jsonb;

-- Seed the rows the Today page shipped with — only where still empty, so a
-- re-run never clobbers later staff edits.
update public.facility_status set details = '[
  {"label": "Carts", "value": "Allowed — 90° rule"},
  {"label": "Greens", "value": "Running fast, firm"},
  {"label": "Tee sheet", "value": "Open till dusk (~8:15)"}
]'::jsonb
where facility = 'golf' and details = '[]'::jsonb;

update public.facility_status set details = '[
  {"label": "Hours", "value": "10:00 AM – 8:00 PM"},
  {"label": "Water", "value": "82° · Adult swim 12–1"},
  {"label": "Lap lanes", "value": "Open till noon"}
]'::jsonb
where facility = 'pool' and details = '[]'::jsonb;

-- ── 2. Lunch buffet (singleton) ─────────────────────────────────────────────
create table if not exists public.dining_buffet (
  -- Singleton: a boolean PK that can only be true caps the table at one row.
  id          boolean primary key default true check (id),
  title       text not null default 'Lunch Buffet',
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

-- Seed the one row with the copy the card shipped with.
insert into public.dining_buffet
  (id, title, start_time, end_time, location, price, description, walk_in, active)
values
  (true, 'Lunch Buffet', '11:00', '14:00', 'Main Dining Room',
   '$18 per person', 'Carving station, Southern sides, and the salad bar.',
   true, true)
  on conflict (id) do nothing;

drop trigger if exists update_dining_buffet_updated_at on public.dining_buffet;
create trigger update_dining_buffet_updated_at
  before update on public.dining_buffet
  for each row execute function public.update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.dining_buffet enable row level security;

grant select, update on public.dining_buffet to authenticated;

-- ---- all authenticated members read ----
drop policy if exists "dining_buffet_select_authenticated" on public.dining_buffet;
create policy "dining_buffet_select_authenticated"
  on public.dining_buffet for select to authenticated using (true);

-- ---- staff/admin update (the single row is seeded, so update is the only write) ----
drop policy if exists "dining_buffet_update_staff_admin" on public.dining_buffet;
create policy "dining_buffet_update_staff_admin"
  on public.dining_buffet for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );
