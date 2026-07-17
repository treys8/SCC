-- ============================================================================
-- SCC — Dining service overrides: closures and special-event days.
--
-- Dining service is entirely derived today: Fri/Sat dinner comes from
-- isStandingReservationDay() plus the reservation_settings singleton's hours,
-- Sunday brunch from the weekday, and the lunch buffet from buffet_week. That
-- leaves no way to say either of the two things staff actually need to say:
--
--   * "we're closed that day"        — every Monday, or a one-off closure.
--   * "that day is different"        — Mother's Day brunch, a Memorial Day
--                                      cookout: its own name, menu, hours, and
--                                      seating caps.
--
-- Two layers, because the two questions have different shapes:
--
--   dining_service_overrides — date-keyed, one row per exceptional DATE. The
--     singleton pattern used by dining_buffet/dining_brunch/club_settings can't
--     express "this specific date differs", so this is a real keyed table.
--     kind='closed'  → no dining, nothing bookable.
--     kind='special' → REPLACES normal service for that date (a special day is
--                      the one thing happening — not a second service running
--                      alongside dinner). NULL hours/caps inherit the singleton.
--
--   club_settings.weekly_closed_weekdays — the standing weekly rule, as ISO
--     weekdays (1=Mon … 7=Sun). Defaults to {1}: the club is closed Mondays.
--
-- Precedence, applied identically in SQL and TS (see src/lib/dining.ts):
--     date override row (either kind)  >  weekly rule  >  normal derived service
-- So "closed every Monday except Memorial Day" is the default {1} plus one
-- kind='special' row on that Monday — no generated rows, no cron, and staff can
-- change it without a deploy.
--
-- enforce_reservation_slot() is rewritten here to consult both layers. It keeps
-- every guarantee it had (SECURITY DEFINER, empty search_path, the per-slot
-- advisory lock that closes the check-then-insert race, self-exclusion by id,
-- the non-active early return) and fires on INSERT OR UPDATE exactly as it has
-- since 20260618000000 — accepting a counter-offer must be re-checked too.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.dining_service_overrides (
  -- One row per exceptional club date; the date IS the key.
  date                      date primary key,
  kind                      text not null check (kind in ('closed', 'special')),
  -- Member-facing name: "Mother's Day Brunch", "Closed for maintenance".
  name                      text,
  -- Menu / details, shown on the Today card and the booking banner.
  description               text,
  -- NULL hours and caps inherit the reservation_settings singleton, so a special
  -- day that only changes its menu needs nothing but a name.
  service_start             time,
  service_end               time,
  max_reservations_per_slot integer check (max_reservations_per_slot >= 0),
  max_covers_per_slot       integer check (max_covers_per_slot >= 0),
  reservations_required     boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  updated_by                uuid references public.profiles(id) on delete set null,
  -- A window is only meaningful if it's a window.
  constraint dining_service_overrides_window_check
    check (service_start is null or service_end is null or service_start < service_end)
);

comment on table public.dining_service_overrides is
  'Date-keyed exceptions to the derived dining schedule: kind=closed (no dining that date) or kind=special (a named service that REPLACES normal service). NULL hours/caps inherit reservation_settings. Beats the club_settings.weekly_closed_weekdays rule.';
comment on column public.dining_service_overrides.reservations_required is
  'Whether the special day needs a booking. Ignored for kind=closed.';

drop trigger if exists update_dining_service_overrides_updated_at
  on public.dining_service_overrides;
create trigger update_dining_service_overrides_updated_at
  before update on public.dining_service_overrides
  for each row execute function public.update_updated_at_column();

-- The standing weekly closure rule. ISO weekdays so it lines up with
-- extract(isodow) below and buffet_week's weekday key (1=Mon … 7=Sun).
alter table public.club_settings
  add column if not exists weekly_closed_weekdays smallint[] not null default '{1}';

comment on column public.club_settings.weekly_closed_weekdays is
  'ISO weekdays (1=Mon … 7=Sun) the club is closed for dining every week. Defaults to {1} (closed Mondays). A dining_service_overrides row for a specific date overrides this, which is how "closed Mondays except Memorial Day" is expressed.';

-- ============================================================================
-- Row-Level Security — member-read / staff-write (the page_sections template).
-- ============================================================================
alter table public.dining_service_overrides enable row level security;

drop policy if exists "dining_service_overrides_select_authenticated"
  on public.dining_service_overrides;
create policy "dining_service_overrides_select_authenticated"
  on public.dining_service_overrides for select to authenticated
  using (true);

drop policy if exists "dining_service_overrides_insert_staff_admin"
  on public.dining_service_overrides;
create policy "dining_service_overrides_insert_staff_admin"
  on public.dining_service_overrides for insert to authenticated
  with check (private.current_user_role() in ('staff', 'admin'));

drop policy if exists "dining_service_overrides_update_staff_admin"
  on public.dining_service_overrides;
create policy "dining_service_overrides_update_staff_admin"
  on public.dining_service_overrides for update to authenticated
  using (private.current_user_role() in ('staff', 'admin'))
  with check (private.current_user_role() in ('staff', 'admin'));

drop policy if exists "dining_service_overrides_delete_staff_admin"
  on public.dining_service_overrides;
create policy "dining_service_overrides_delete_staff_admin"
  on public.dining_service_overrides for delete to authenticated
  using (private.current_user_role() in ('staff', 'admin'));

-- ============================================================================
-- Capacity/window enforcement, now override-aware.
--
-- Unchanged from 20260607010000 except for the override lookup and the eff_*
-- values replacing the singleton's directly: same advisory lock, same counting,
-- same self-exclusion, same early return for non-capacity-consuming statuses.
-- ============================================================================
create or replace function public.enforce_reservation_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s            public.reservation_settings;
  o            public.dining_service_overrides;
  wcd          smallint[];
  eff_start    time;
  eff_end      time;
  eff_res_cap  integer;
  eff_cov_cap  integer;
  res_count    integer;
  cover_count  integer;
begin
  -- Only active reservations consume capacity.
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  select * into s from public.reservation_settings where id = 1;
  select * into o from public.dining_service_overrides
    where date = new.reservation_date;

  -- Closed for the day: an explicit closure, else the standing weekly rule.
  -- A date row of EITHER kind beats the weekly rule — that's what makes a
  -- special day on a normally-closed Monday bookable.
  if o.date is not null and o.kind = 'closed' then
    raise exception 'The club is closed for dining on %.',
      to_char(new.reservation_date, 'FMMonth FMDD')
      using errcode = 'check_violation';
  end if;

  if o.date is null then
    select weekly_closed_weekdays into wcd from public.club_settings where id = true;
    if extract(isodow from new.reservation_date)::smallint
       = any (coalesce(wcd, '{}'::smallint[])) then
      raise exception 'The club is closed for dining on %.',
        to_char(new.reservation_date, 'FMDay')
        using errcode = 'check_violation';
    end if;
  end if;

  -- A special day's hours/caps replace the singleton's; NULL inherits.
  eff_start   := coalesce(o.service_start, s.service_start);
  eff_end     := coalesce(o.service_end,   s.service_end);
  eff_res_cap := coalesce(o.max_reservations_per_slot, s.max_reservations_per_slot);
  eff_cov_cap := coalesce(o.max_covers_per_slot,       s.max_covers_per_slot);

  -- Must land on a valid slot boundary, measured FROM that day's service start
  -- — which is how the booking form generates its chips (generateSlots steps
  -- from service_start). Anchoring to the top of the hour instead would make an
  -- 11:30 special-day start unbookable at a 60-minute cadence: the form would
  -- offer 11:30/12:30 and every one would be rejected here. For the standing
  -- 17:00 window the two are identical, so this changes nothing for normal days.
  -- Cadence stays global: an override changes when service runs and how full it
  -- gets, not the spacing of the seatings.
  if extract(second from new.reservation_time) <> 0
     or ((((extract(epoch from new.reservation_time)
            - extract(epoch from eff_start))::int) / 60) % s.slot_minutes) <> 0 then
    raise exception 'Reservation time must be one of that day''s seatings (every % minutes from %).',
      s.slot_minutes, to_char(eff_start, 'HH12:MI AM')
      using errcode = 'check_violation';
  end if;

  -- Must fall inside the effective service window.
  if new.reservation_time < eff_start
     or new.reservation_time >= eff_end then
    raise exception 'Reservations are available between % and %.',
      to_char(eff_start, 'HH12:MI AM'),
      to_char(eff_end,   'HH12:MI AM')
      using errcode = 'check_violation';
  end if;

  -- Serialize same-slot inserts only (different slots stay concurrent).
  perform pg_advisory_xact_lock(
    hashtextextended(new.reservation_date::text || ' ' || new.reservation_time::text, 0)
  );

  select count(*), coalesce(sum(party_size), 0)
    into res_count, cover_count
  from public.reservations
  where reservation_date = new.reservation_date
    and reservation_time = new.reservation_time
    and status in ('pending', 'confirmed')
    and id <> new.id;

  if res_count + 1 > eff_res_cap then
    raise exception 'This time is fully booked. Please choose another slot.'
      using errcode = 'check_violation';
  end if;

  if cover_count + new.party_size > eff_cov_cap then
    raise exception 'Not enough seats remain at this time for a party of %.', new.party_size
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_reservation_slot() from public, anon, authenticated;

-- Recreate on INSERT OR UPDATE (as of 20260618000000): accepting a counter-offer
-- moves a reservation into a new slot via UPDATE and must be re-validated.
drop trigger if exists enforce_reservation_slot_trg on public.reservations;
create trigger enforce_reservation_slot_trg
  before insert or update on public.reservations
  for each row execute function public.enforce_reservation_slot();
