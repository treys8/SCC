-- ============================================================================
-- SCC — Reservations: Front-of-House counter-offer ("propose a time")
--
-- When the FOH manager declines a request, they can offer an alternate slot the
-- member can one-tap accept. A row with status='declined' AND proposed_date/time
-- set means "declined, but we offered another time — awaiting the member." The
-- member's accept runs server-side (service-role), so the strict member-update
-- guard stays untouched.
--
-- Also: extend capacity enforcement to UPDATE. The accept-proposal flow moves a
-- reservation into a new slot via UPDATE, but enforce_reservation_slot_trg was
-- BEFORE INSERT only — so the new slot's caps were never checked. The trigger's
-- logic is already update-safe (it excludes the row itself by id and early-returns
-- for non-active statuses), so firing it on UPDATE closes that gap without
-- affecting decline/cancel/confirm.
--
-- Builds on 20260607010000_reservations_system.sql. Idempotent.
-- ============================================================================

alter table public.reservations
  add column if not exists proposed_date date,
  add column if not exists proposed_time time;

drop trigger if exists enforce_reservation_slot_trg on public.reservations;
create trigger enforce_reservation_slot_trg
  before insert or update on public.reservations
  for each row execute function public.enforce_reservation_slot();
