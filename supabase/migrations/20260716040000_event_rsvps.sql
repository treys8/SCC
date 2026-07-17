-- ============================================================================
-- SCC — Event RSVPs (staff-facing headcount).
--
-- Club-run events that don't go through GolfGenius — trivia night, a wine
-- dinner — have no way to capture intent. Staff cook and set tables blind, and
-- a member has no way to say "I'm coming". This is that: one tap, no payment,
-- no ticketing. Tournaments stay on GolfGenius; an event with a
-- registration_url deep-links out and never offers an RSVP (the app enforces
-- that — two sign-up paths for one event would split the count).
--
-- The count is STAFF-ONLY, deliberately: members see whether *they* are going,
-- never who else is or how many. It's a headcount for the kitchen, not a social
-- feed — and the club's culture (see the Clubster read) is a broadcast one.
-- RLS is what enforces that, not the UI: the select policy is own-or-staff.
--
-- party_size is stored from the start though the v1 UI is a binary "I'm coming"
-- (every row is 1). It's free here, and turning it into a stepper later becomes
-- a UI change rather than a migration on a table with live rows.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.event_rsvps (
  event_id   uuid not null references public.calendar_events(id) on delete cascade,
  member_id  uuid not null references public.profiles(id) on delete cascade,
  party_size integer not null default 1 check (party_size between 1 and 20),
  created_at timestamptz not null default now(),
  -- One RSVP per member per event; the PK is the dedupe.
  primary key (event_id, member_id)
);

comment on table public.event_rsvps is
  'Member "I''m coming" for club-run events (never for GolfGenius-linked ones). The headcount is staff-only by RLS — members can read their own row and nobody else''s.';
comment on column public.event_rsvps.party_size is
  'Guests in the party. Always 1 from the v1 binary UI; stored so a stepper is a UI change, not a migration.';

-- ============================================================================
-- Row-Level Security — own-or-staff read (mirrors reservations), own writes.
--
-- No update policy: the v1 toggle is insert/delete, and a member has no field
-- worth editing. Add one alongside a party-size stepper if that ever lands.
-- ============================================================================
alter table public.event_rsvps enable row level security;

drop policy if exists "event_rsvps_select_own_or_staff" on public.event_rsvps;
create policy "event_rsvps_select_own_or_staff"
  on public.event_rsvps for select to authenticated
  using (
    member_id = (select auth.uid())
    or private.current_user_role() in ('staff', 'admin')
  );

drop policy if exists "event_rsvps_insert_own" on public.event_rsvps;
create policy "event_rsvps_insert_own"
  on public.event_rsvps for insert to authenticated
  with check (member_id = (select auth.uid()));

drop policy if exists "event_rsvps_delete_own_or_staff" on public.event_rsvps;
create policy "event_rsvps_delete_own_or_staff"
  on public.event_rsvps for delete to authenticated
  using (
    member_id = (select auth.uid())
    or private.current_user_role() in ('staff', 'admin')
  );
