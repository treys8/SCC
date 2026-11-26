-- ============================================================================
-- SCC — Event capacity, sign-up deadline, and waitlist.
--
-- Club-run events with a hard limit (the Fall Wine Tasting: 48 seats, sign up
-- by Tue 3:00 PM) were run over email and text, with staff posting "18 spots
-- left!" updates by hand. This makes the RSVP carry that:
--
--   calendar_events.capacity        — max PEOPLE (sum of party sizes). NULL =
--                                     uncapped, exactly today's behaviour.
--   calendar_events.signup_deadline — after this instant no new sign-ups and no
--                                     party increases. Withdrawing stays open.
--   event_waitlist                  — members waiting on a full event.
--   get_event_availability()        — the aggregate "spots left" for a capped
--                                     event. Members still never see WHO is
--                                     coming (event_rsvps RLS is unchanged);
--                                     the club does publish the count, so the
--                                     number alone is exposed through a definer
--                                     function rather than a wider policy.
--
-- The cap is enforced by a SECURITY DEFINER trigger under a per-event advisory
-- lock — the same shape as enforce_reservation_slot — so concurrent taps can't
-- oversell. It MUST be definer: event_rsvps RLS shows a member only their own
-- row, so an invoker trigger would sum one row and never refuse anyone.
--
-- When a spot frees, every waiter whose party fits is notified at once and the
-- first to sign up wins (mirrors reservation_waitlist). The trigger arbitrates.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---- calendar_events columns ----------------------------------------------
alter table public.calendar_events
  add column if not exists capacity integer,
  add column if not exists signup_deadline timestamptz;

alter table public.calendar_events
  drop constraint if exists calendar_events_capacity_check;
alter table public.calendar_events
  add constraint calendar_events_capacity_check
  check (capacity is null or capacity between 1 and 1000);

comment on column public.calendar_events.capacity is
  'Max people across all RSVPs (sum of party_size). NULL = no limit. Enforced by enforce_event_rsvp().';
comment on column public.calendar_events.signup_deadline is
  'No new RSVPs or party increases after this instant. Withdrawing is always allowed. NULL = open until the event date.';

-- ---- event_rsvps: allow a member to change their own party size -----------
-- v1 had no update policy (binary toggle). A party-size change is now an
-- UPDATE, re-checked by the trigger below.
drop policy if exists "event_rsvps_update_own" on public.event_rsvps;
create policy "event_rsvps_update_own"
  on public.event_rsvps for update to authenticated
  using      (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));

grant update on public.event_rsvps to authenticated;

-- ---- cap + deadline trigger -------------------------------------------------
create or replace function public.enforce_event_rsvp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap      integer;
  v_deadline timestamptz;
  v_taken    integer;
  v_growing  boolean;
begin
  if tg_op = 'UPDATE'
     and (new.event_id is distinct from old.event_id
          or new.member_id is distinct from old.member_id) then
    raise exception 'An RSVP cannot be moved to another event or member';
  end if;

  v_growing := tg_op = 'INSERT' or new.party_size > old.party_size;
  if not v_growing then
    return new;                         -- shrinking a party never needs a check
  end if;

  select capacity, signup_deadline
    into v_cap, v_deadline
    from public.calendar_events
    where id = new.event_id;

  -- Deadline: the service role (auth.uid() is null — staff tooling, seeds)
  -- may still add people after it closes; members may not — except someone
  -- who joined the waitlist before the deadline, taking a spot a withdrawal
  -- freed afterwards (that's what the waitlist is for).
  if auth.uid() is not null
     and v_deadline is not null
     and now() > v_deadline
     and not (
       tg_op = 'INSERT'
       and exists (
         select 1 from public.event_waitlist w
          where w.event_id = new.event_id
            and w.member_id = new.member_id
            and w.party_size >= new.party_size
            and w.created_at <= v_deadline
       )
     ) then
    raise exception 'Sign-ups for this event have closed.';
  end if;

  if v_cap is null then
    return new;
  end if;

  -- Serialize every growing write on this event so two last-spot taps can't
  -- both pass the sum check.
  perform pg_advisory_xact_lock(hashtextextended('event_rsvp:' || new.event_id::text, 0));

  select coalesce(sum(party_size), 0)
    into v_taken
    from public.event_rsvps
    where event_id = new.event_id
      and member_id <> new.member_id;  -- self-exclusion: an UPDATE replaces its own row

  if v_taken + new.party_size > v_cap then
    if v_cap - v_taken <= 0 then
      raise exception 'This event is full.';
    end if;
    raise exception 'Only % % left for this event.',
      v_cap - v_taken,
      case when v_cap - v_taken = 1 then 'spot' else 'spots' end;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_event_rsvp() from public, anon, authenticated;

drop trigger if exists enforce_event_rsvp_trg on public.event_rsvps;
create trigger enforce_event_rsvp_trg
  before insert or update on public.event_rsvps
  for each row execute function public.enforce_event_rsvp();

-- ---- availability (aggregate only) -----------------------------------------
-- Returns no row for an uncapped or unknown event: there's no count to show.
create or replace function public.get_event_availability(p_event_id uuid)
returns table (capacity integer, taken integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.capacity,
         coalesce((select sum(r.party_size)::integer
                     from public.event_rsvps r
                    where r.event_id = e.id), 0)
    from public.calendar_events e
   where e.id = p_event_id
     and e.capacity is not null
$$;
revoke all on function public.get_event_availability(uuid) from public, anon;
grant execute on function public.get_event_availability(uuid) to authenticated;

-- ---- event_waitlist ----------------------------------------------------------
create table if not exists public.event_waitlist (
  event_id    uuid not null references public.calendar_events(id) on delete cascade,
  member_id   uuid not null references public.profiles(id) on delete cascade,
  party_size  integer not null default 1 check (party_size between 1 and 20),
  created_at  timestamptz not null default now(),
  notified_at timestamptz,
  primary key (event_id, member_id)
);

comment on table public.event_waitlist is
  'Members waiting on a full capped event. When a spot frees, every waiter whose party fits is notified at once and the first to sign up wins (enforce_event_rsvp arbitrates).';
comment on column public.event_waitlist.notified_at is
  'When the "a spot opened" notification was claimed for this row. Written only by the server (service role).';

-- RLS — own-or-staff read, own insert, own-or-staff delete. No update policy:
-- notified_at must stay server-only (a member who could clear it could notify
-- themselves repeatedly), and changing party size is leave + rejoin.
alter table public.event_waitlist enable row level security;

revoke all on public.event_waitlist from anon;
grant select, insert, delete on public.event_waitlist to authenticated;

drop policy if exists "event_waitlist_select_own_or_staff" on public.event_waitlist;
create policy "event_waitlist_select_own_or_staff"
  on public.event_waitlist for select to authenticated
  using (
    member_id = (select auth.uid())
    or private.current_user_role() in ('staff', 'admin')
  );

drop policy if exists "event_waitlist_insert_own" on public.event_waitlist;
create policy "event_waitlist_insert_own"
  on public.event_waitlist for insert to authenticated
  with check (member_id = (select auth.uid()) and notified_at is null);

drop policy if exists "event_waitlist_delete_own_or_staff" on public.event_waitlist;
create policy "event_waitlist_delete_own_or_staff"
  on public.event_waitlist for delete to authenticated
  using (
    member_id = (select auth.uid())
    or private.current_user_role() in ('staff', 'admin')
  );
