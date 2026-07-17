-- ============================================================================
-- SCC — Reservation waitlist for full seatings.
--
-- Today a full slot is indistinguishable from an open one until the member taps
-- Request and the capacity trigger rejects them — every seating is offered, and
-- nothing captures "I'd have come if there'd been room". This adds:
--
--   reservation_waitlist   — one row per member per seating they're waiting on.
--   get_slot_availability  — how full each seating is, so the booking form can
--                            show "Full · waitlist" instead of a dead end.
--
-- When capacity frees up (a decline, a cancel, a counter-offer moving a party),
-- everyone waiting on that seating is notified at once and the first to book
-- wins — the capacity trigger's advisory lock arbitrates the race, so the club
-- can't oversell no matter how many members tap at the same moment. At club
-- scale that's kinder than an auto-assign, and it needs no holds or timers.
--
-- Rows are notified once (notified_at claims them, like the reminder cron) and
-- purged the day after their date by the reservation-reminders cron.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.reservation_waitlist (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references public.profiles(id) on delete cascade,
  reservation_date date not null,
  reservation_time time not null,
  party_size       integer not null check (party_size between 1 and 50),
  created_at       timestamptz not null default now(),
  notified_at      timestamptz,
  -- One entry per member per seating; re-joining is a no-op, not a duplicate.
  unique (member_id, reservation_date, reservation_time)
);

comment on table public.reservation_waitlist is
  'Members waiting on a full seating. When capacity frees, all waiters for that slot are notified at once and the first to book wins (the reservations capacity trigger arbitrates). Purged after the date passes by the reservation-reminders cron.';
comment on column public.reservation_waitlist.notified_at is
  'When the "a table opened up" notification was claimed for this row. Written only by the server (service role).';

-- The notify-on-free path looks up every waiter for one date+time.
create index if not exists reservation_waitlist_slot_idx
  on public.reservation_waitlist (reservation_date, reservation_time);

-- ============================================================================
-- Row-Level Security — own-or-staff (mirrors reservations).
--
-- No update policy: there's nothing for a member to edit (leaving is a delete),
-- and notified_at must stay server-only — a member who could clear it could
-- notify themselves repeatedly.
-- ============================================================================
alter table public.reservation_waitlist enable row level security;

drop policy if exists "reservation_waitlist_select_own_or_staff"
  on public.reservation_waitlist;
create policy "reservation_waitlist_select_own_or_staff"
  on public.reservation_waitlist for select to authenticated
  using (
    member_id = (select auth.uid())
    or private.current_user_role() in ('staff', 'admin')
  );

drop policy if exists "reservation_waitlist_insert_own" on public.reservation_waitlist;
create policy "reservation_waitlist_insert_own"
  on public.reservation_waitlist for insert to authenticated
  with check (member_id = (select auth.uid()));

drop policy if exists "reservation_waitlist_delete_own_or_staff"
  on public.reservation_waitlist;
create policy "reservation_waitlist_delete_own_or_staff"
  on public.reservation_waitlist for delete to authenticated
  using (
    member_id = (select auth.uid())
    or private.current_user_role() in ('staff', 'admin')
  );

-- ============================================================================
-- Slot availability.
--
-- ⚠️  This MUST stay in step with enforce_reservation_slot() (see
--     20260716020000_dining_service_overrides.sql): same service window, same
--     effective caps, same "only pending/confirmed consume capacity" rule.
--
-- The trigger remains the sole authority — this only decides what the booking
-- form draws. Drift can therefore mis-render a chip, but can never oversell:
-- an optimistic reading here still gets rejected at INSERT.
--
-- SECURITY DEFINER so it can read reservation_settings and count other members'
-- reservations (a member can only SELECT their own), returning nothing but
-- aggregates — never who booked.
-- ============================================================================
create or replace function public.get_slot_availability(p_dates date[])
returns table (
  slot_date   date,
  slot_time   time,
  res_count   integer,
  cover_count integer,
  max_res     integer,
  max_covers  integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s   public.reservation_settings;
  wcd smallint[];
begin
  if p_dates is null or array_length(p_dates, 1) is null then
    return;
  end if;
  -- Bound the fan-out; the booking form asks for a week at a time.
  if array_length(p_dates, 1) > 31 then
    raise exception 'Too many dates requested.';
  end if;

  select * into s from public.reservation_settings where id = 1;
  select weekly_closed_weekdays into wcd from public.club_settings where id = true;

  return query
  with days as (
    select
      d::date                                                   as the_date,
      o.kind                                                    as kind,
      coalesce(o.service_start, s.service_start)                as eff_start,
      coalesce(o.service_end,   s.service_end)                  as eff_end,
      coalesce(o.max_reservations_per_slot, s.max_reservations_per_slot) as eff_res,
      coalesce(o.max_covers_per_slot,       s.max_covers_per_slot)       as eff_cov,
      o.date is not null                                        as has_override
    from unnest(p_dates) as d
    left join public.dining_service_overrides o on o.date = d::date
  ),
  open_days as (
    -- Same precedence as the trigger: a date row of either kind beats the
    -- weekly rule; 'closed' yields no seatings at all. A non-positive window
    -- (an override whose start lands after the inherited end) yields none
    -- either — the form draws nothing for it, and offering a phantom seating
    -- here would page waitlisters toward a time the trigger refuses.
    select * from days
    where coalesce(kind, '') <> 'closed'
      and eff_end > eff_start
      and (
        has_override
        or extract(isodow from the_date)::smallint
           <> all (coalesce(wcd, '{}'::smallint[]))
      )
  ),
  slots as (
    select
      od.the_date,
      (od.eff_start + (n || ' minutes')::interval)::time as the_time,
      od.eff_res,
      od.eff_cov
    from open_days od
    -- Upper bound is duration-1, NOT duration-slot_minutes: the seatings are
    -- every start strictly before eff_end (exactly what generateSlots emits
    -- with `t < end`). Subtracting a whole slot silently drops the final
    -- seating whenever the window isn't a whole multiple of the cadence — an
    -- 11:00-14:20 day would lose 14:00, whose chip would then never read
    -- "Full" and whose waitlisters could never be notified.
    cross join lateral generate_series(
      0,
      (extract(epoch from (od.eff_end - od.eff_start))::int / 60) - 1,
      s.slot_minutes
    ) as n
  )
  select
    sl.the_date,
    sl.the_time,
    coalesce(count(r.id), 0)::integer,
    coalesce(sum(r.party_size), 0)::integer,
    sl.eff_res,
    sl.eff_cov
  from slots sl
  left join public.reservations r
    on r.reservation_date = sl.the_date
   and r.reservation_time = sl.the_time
   and r.status in ('pending', 'confirmed')
  group by sl.the_date, sl.the_time, sl.eff_res, sl.eff_cov
  order by sl.the_date, sl.the_time;
end;
$$;

revoke all on function public.get_slot_availability(date[]) from public, anon;
grant execute on function public.get_slot_availability(date[]) to authenticated;
