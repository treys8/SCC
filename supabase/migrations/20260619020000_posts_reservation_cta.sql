-- ============================================================================
-- Feed posts can show a "Reserve a table" button.
--
-- The dining parallel to posts.event_id (Register → GolfGenius): a chef's
-- dinner-special post should hand off to the club's concierge booking flow
-- (/reservations) instead of burying "email us for a reservation" in prose.
-- There's exactly one booking destination, so this is a render flag, not a FK.
--
-- Additive, idempotent; no index/RLS change (just a flag on an already-readable
-- row, rendered client-side).
-- ============================================================================

alter table public.posts
  add column if not exists reservation_cta boolean not null default false;
