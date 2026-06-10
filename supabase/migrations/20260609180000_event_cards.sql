-- ============================================================================
-- SCC Phase 2 — event cards + GolfGenius handoff.
--
-- Presentation/action fields for calendar_events so events can render as
-- actionable cards (cover image, Register deep-link, fee note):
--   * registration_url — external registration page (GolfGenius etc.);
--     the app deep-links out, it never rebuilds registration.
--   * fee — short freeform note ("$50 per player", "Free for members").
--     Freeform on purpose: club pricing rarely fits a single number.
--   * cover_image_url — public URL of an optional cover photo. Uploaded
--     browser-direct to the existing public `posts` bucket (same path
--     convention and Storage RLS as feed attachments).
--
-- No RLS changes: existing calendar_events policies already cover these
-- columns (read for authenticated, write for staff/admin).
-- Idempotent: safe to run more than once.
-- ============================================================================

alter table public.calendar_events
  add column if not exists registration_url text,
  add column if not exists fee text,
  add column if not exists cover_image_url text;
