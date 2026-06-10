-- ============================================================================
-- SCC Phase 3 — Facility status widget (golf / pool).
--
-- A single source of truth for each facility's operational state so members
-- stop phoning the pro shop to learn about a frost delay or lightning hold.
-- One seeded row per facility; staff flip the state with one-tap presets, and
-- members see a pinned, realtime-updating widget.
--
--   * facility   — primary key; only 'golf' and 'pool' have an op status.
--   * status     — current state. Text + CHECK (not an enum) so later phases
--                  can add states without `alter type`. The preset buttons map:
--                    Frost          -> frost_delay
--                    Rain           -> rain_delay
--                    Lightning hold -> lightning_hold
--                    Open / All clear -> open
--                    Closed         -> closed
--   * message    — optional staff note ("Cart path only", "Front 9 open").
--                  Presets clear it; a separate message edit sets it.
--   * updated_at — touched by the shared update_updated_at_column() trigger.
--   * updated_by — who last changed it (nullable; profile may be deleted).
--
-- RLS mirrors calendar_events / reservation_settings: every authenticated
-- member reads; only staff/admin update. Rows are seeded here and never
-- inserted/deleted from the app, so no insert/delete grant or policy exists.
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.facility_status (
  facility    text primary key check (facility in ('golf', 'pool')),
  status      text not null default 'open'
                check (status in ('open', 'closed', 'frost_delay',
                                  'rain_delay', 'lightning_hold')),
  message     text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

-- One row per facility; the widget always has something to show.
insert into public.facility_status (facility) values ('golf'), ('pool')
  on conflict (facility) do nothing;

drop trigger if exists update_facility_status_updated_at on public.facility_status;
create trigger update_facility_status_updated_at
  before update on public.facility_status
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.facility_status enable row level security;

grant select, update on public.facility_status to authenticated;

-- ---- all authenticated members read ----
drop policy if exists "facility_status_select_authenticated" on public.facility_status;
create policy "facility_status_select_authenticated"
  on public.facility_status for select to authenticated using (true);

-- ---- staff/admin update (rows are seeded, so update is the only write) ----
drop policy if exists "facility_status_update_staff_admin" on public.facility_status;
create policy "facility_status_update_staff_admin"
  on public.facility_status for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );

-- ============================================================================
-- Realtime: stream status changes (UPDATE events) to subscribed members. RLS
-- still gates delivery; facility_status is readable by every authenticated
-- member. The widget reads payload.new (all columns present on UPDATE), so the
-- default replica identity (primary key) is sufficient — no REPLICA IDENTITY FULL.
-- ============================================================================
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'facility_status'
  ) then
    alter publication supabase_realtime add table public.facility_status;
  end if;
end $$;
