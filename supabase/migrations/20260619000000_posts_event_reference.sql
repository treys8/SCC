-- ============================================================================
-- Feed posts can reference a calendar event.
--
-- The Feed is where announcements live, but a post couldn't carry a
-- registration CTA — only calendar_events have registration_url + a Register
-- button. Linking a post to an event lets the feed card render that event's
-- Register button (date/fee) inline, so e.g. a Club Championship announcement
-- can hand off to GolfGenius without staff duplicating it as a separate event.
--
-- ON DELETE SET NULL: deleting an event just unlinks it from any posts (the
-- announcement text stays; the event block disappears). No RLS change needed —
-- posts and calendar_events both already allow authenticated SELECT on all rows
-- (init.sql), so a member viewing a post can read its referenced event.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

alter table public.posts
  add column if not exists event_id uuid
    references public.calendar_events(id) on delete set null;

create index if not exists posts_event_id_idx on public.posts (event_id);
