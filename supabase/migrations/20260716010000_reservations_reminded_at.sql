-- Reservation day-of reminders: send bookkeeping.
--
-- A confirmed reservation is announced once, when staff confirm it — often days
-- ahead — and then never mentioned again. This adds the column behind a daily
-- reminder ("Tonight at 6:30, party of 4") sent the afternoon of the booking.
--
-- reminded_at is claimed by the cron with a conditional
--   UPDATE ... WHERE reservation_date = today
--                AND status = 'confirmed'
--                AND reminded_at IS NULL
-- so an overlapping or retried run can only ever remind a member once.
--
-- Deliberately NOT added to guard_reservation_member_update()'s list of
-- member-writable columns: only the cron writes this, and the guard exempts the
-- service role (auth.uid() is null). A member touching it still trips the guard.
--
-- Idempotent: safe to run more than once.

alter table public.reservations
  add column if not exists reminded_at timestamptz;

comment on column public.reservations.reminded_at is
  'When the day-of reminder was claimed for this reservation. Non-null means it has been sent — the claim (UPDATE ... WHERE reminded_at IS NULL) is the double-send guard. Written only by the reservation-reminders cron (service role).';
