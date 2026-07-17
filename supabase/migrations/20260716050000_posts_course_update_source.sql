-- ============================================================================
-- SCC — "From the course": share a golf-log entry with members.
--
-- The superintendent already writes up the course every day — what got done,
-- what's being worked on, often with a photo — but golf_log_entries is private
-- to course leadership by design (RLS by title), so members never see any of it.
-- Meanwhile the thing members most want from the golf side is exactly that:
-- what's the course like today.
--
-- Rather than build a second member-facing surface, sharing an entry creates a
-- normal published post (golf, club voice) — so it lands in the feed, is
-- searchable, renders with the existing PostCard, and can be edited or deleted
-- like any other post. The log stays private; the share is a copy, deliberately,
-- so a later edit to the private entry can't silently rewrite what members read.
--
-- source_golf_log_entry_id marks that copy. It powers:
--   * the "Shared ✓" state on the log entry,
--   * the Today "From the course" card (the most recent one),
--   * and, via the partial unique index, the share-once guard. Deleting the post
--     frees the entry to be shared again.
--
-- ON DELETE SET NULL, not CASCADE: deleting a private log entry must never take
-- a published member-facing post down with it. The post just loses its origin.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

alter table public.posts
  add column if not exists source_golf_log_entry_id uuid
    references public.golf_log_entries(id) on delete set null;

comment on column public.posts.source_golf_log_entry_id is
  'The golf-log entry this post was shared from, if any. Marks the post as a "From the course" update (Today card + the log''s Shared state). SET NULL on delete: removing the private entry must not remove the published post.';

-- Share-once: one post per log entry. Partial, so the (vast) majority of posts
-- with no source stay out of the index.
create unique index if not exists posts_source_golf_log_entry_unique
  on public.posts (source_golf_log_entry_id)
  where source_golf_log_entry_id is not null;
