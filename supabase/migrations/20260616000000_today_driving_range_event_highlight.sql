-- ============================================================================
-- SCC — Driving range (4th conditions facility) + per-event "Today highlight".
--
-- 1. Driving range joins golf/pool/tennis as a status-only facility. The staff
--    console and Today page are generic over the FACILITIES list, so this is
--    just: widen the CHECK, seed the row, seed a couple of detail rows.
-- 2. calendar_events.is_highlight opts a single event into the featured "Tonight"
--    card on the Today page. Defaults false; staff flip it in the event form.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ── 1. Driving range facility ──────────────────────────────────────────────
alter table public.facility_status
  drop constraint if exists facility_status_facility_check;
alter table public.facility_status
  add constraint facility_status_facility_check
  check (facility in ('golf', 'pool', 'tennis', 'driving_range'));

insert into public.facility_status (facility) values ('driving_range')
  on conflict (facility) do nothing;

-- Seed the rows the range card shows by default (only where still empty, so a
-- re-run never clobbers later staff edits).
update public.facility_status set details = '[
  {"label": "Mats", "value": "Open"},
  {"label": "Range balls", "value": "Available"},
  {"label": "Hours", "value": "Open till dusk"}
]'::jsonb
where facility = 'driving_range' and details = '[]'::jsonb;

-- ── 2. Today highlight flag ────────────────────────────────────────────────
alter table public.calendar_events
  add column if not exists is_highlight boolean not null default false;
