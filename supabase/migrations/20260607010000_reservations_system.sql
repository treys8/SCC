-- ============================================================================
-- SCC — Reservations system
-- Seating map, per-slot capacity controls, declined status, in-app
-- notifications, and race-safe enforcement.
--
-- Builds on 20260607000000_init.sql. Idempotent where practical.
-- Apply via the Supabase SQL Editor or `supabase db push`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reservations.status: add 'declined' (distinct from member 'cancelled')
-- ---------------------------------------------------------------------------
alter table public.reservations
  drop constraint if exists reservations_status_check;
alter table public.reservations
  add constraint reservations_status_check
  check (status in ('pending', 'confirmed', 'declined', 'cancelled'));

-- ---------------------------------------------------------------------------
-- Seating map: tables staff fill with reservations
-- ---------------------------------------------------------------------------
create table if not exists public.dining_tables (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  seats       integer not null check (seats > 0),
  section     text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists dining_tables_active_idx
  on public.dining_tables (is_active, sort_order);

-- ---------------------------------------------------------------------------
-- Capacity / service settings (single row, id is pinned to 1)
-- ---------------------------------------------------------------------------
create table if not exists public.reservation_settings (
  id                        integer primary key default 1 check (id = 1),
  slot_minutes              integer not null default 30
                              check (slot_minutes in (15, 30, 60)),
  service_start             time not null default '17:00',
  service_end               time not null default '21:00',
  max_reservations_per_slot integer not null default 6
                              check (max_reservations_per_slot >= 0),
  max_covers_per_slot       integer not null default 40
                              check (max_covers_per_slot >= 0),
  updated_at                timestamptz not null default now()
);
insert into public.reservation_settings (id) values (1)
  on conflict (id) do nothing;

drop trigger if exists update_reservation_settings_updated_at on public.reservation_settings;
create trigger update_reservation_settings_updated_at
  before update on public.reservation_settings
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- reservations: table assignment + staff note (decline reason)
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists table_id uuid
    references public.dining_tables(id) on delete set null;
alter table public.reservations
  add column if not exists staff_note text;

-- One confirmed reservation per table per slot — prevents double-booking.
create unique index if not exists reservations_table_slot_unique
  on public.reservations (table_id, reservation_date, reservation_time)
  where status = 'confirmed' and table_id is not null;

-- ---------------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            text not null,
  title           text not null,
  body            text,
  link            text,
  reservation_id  uuid references public.reservations(id) on delete cascade,
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, is_read, created_at desc);

-- ============================================================================
-- Functions & triggers
-- ============================================================================

-- Snap-to-slot, service-window, and dual-capacity enforcement. Runs as the
-- table owner (SECURITY DEFINER) so it can read settings regardless of caller.
-- A per-slot advisory lock serializes concurrent inserts into the SAME slot,
-- closing the check-then-insert race so caps can't be oversold.
create or replace function public.enforce_reservation_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s            public.reservation_settings;
  res_count    integer;
  cover_count  integer;
begin
  -- Only active reservations consume capacity.
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  select * into s from public.reservation_settings where id = 1;

  -- Must land on a valid slot boundary.
  if extract(second from new.reservation_time) <> 0
     or (extract(minute from new.reservation_time)::int % s.slot_minutes) <> 0 then
    raise exception 'Reservation time must align to a %-minute slot.', s.slot_minutes
      using errcode = 'check_violation';
  end if;

  -- Must fall inside the service window.
  if new.reservation_time < s.service_start
     or new.reservation_time >= s.service_end then
    raise exception 'Reservations are available between % and %.',
      to_char(s.service_start, 'HH12:MI AM'),
      to_char(s.service_end,   'HH12:MI AM')
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

  if res_count + 1 > s.max_reservations_per_slot then
    raise exception 'This time is fully booked. Please choose another slot.'
      using errcode = 'check_violation';
  end if;

  if cover_count + new.party_size > s.max_covers_per_slot then
    raise exception 'Not enough seats remain at this time for a party of %.', new.party_size
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_reservation_slot() from public, anon, authenticated;

drop trigger if exists enforce_reservation_slot_trg on public.reservations;
create trigger enforce_reservation_slot_trg
  before insert on public.reservations
  for each row execute function public.enforce_reservation_slot();

-- Members may only CANCEL their own reservation: they cannot self-confirm,
-- reassign a table, or alter the slot/party. Staff, admins, and trusted
-- server code (service role, no JWT) are exempt. Closes the privilege hole in
-- the broad "update own or staff" RLS policy.
create or replace function public.guard_reservation_member_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;                                      -- service role / trusted server
  end if;
  if private.current_user_role() in ('staff', 'admin') then
    return new;
  end if;

  -- The owning member: the only legal change is status -> 'cancelled'.
  if new.status            is distinct from 'cancelled'
     or new.member_id        is distinct from old.member_id
     or new.reservation_date is distinct from old.reservation_date
     or new.reservation_time is distinct from old.reservation_time
     or new.party_size       is distinct from old.party_size
     or new.special_requests is distinct from old.special_requests
     or new.table_id         is distinct from old.table_id
     or new.staff_note       is distinct from old.staff_note then
    raise exception 'Members may only cancel their own reservation.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_reservation_member_update() from public, anon, authenticated;

drop trigger if exists guard_reservation_member_update_trg on public.reservations;
create trigger guard_reservation_member_update_trg
  before update on public.reservations
  for each row execute function public.guard_reservation_member_update();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.dining_tables        enable row level security;
alter table public.reservation_settings enable row level security;
alter table public.notifications         enable row level security;

grant select, insert, update, delete on public.dining_tables to authenticated;
grant select, update                  on public.reservation_settings to authenticated;
grant select, update                  on public.notifications to authenticated;

-- ---- dining_tables: all authenticated read; staff/admin manage ----
drop policy if exists "tables_select_authenticated" on public.dining_tables;
create policy "tables_select_authenticated"
  on public.dining_tables for select to authenticated using (true);

drop policy if exists "tables_write_staff_admin" on public.dining_tables;
create policy "tables_write_staff_admin"
  on public.dining_tables for all to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );

-- ---- reservation_settings: all authenticated read (members need slot/window
--      info to book); staff/admin update ----
drop policy if exists "settings_select_authenticated" on public.reservation_settings;
create policy "settings_select_authenticated"
  on public.reservation_settings for select to authenticated using (true);

drop policy if exists "settings_update_staff_admin" on public.reservation_settings;
create policy "settings_update_staff_admin"
  on public.reservation_settings for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );

-- ---- notifications: recipients read & mark-read their own. Inserts come from
--      trusted server code (service-role client), so NO insert policy exists. ----
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using ( user_id = (select auth.uid()) );

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using      ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );
