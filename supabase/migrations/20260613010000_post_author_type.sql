-- ============================================================================
-- Posts: author voice (club vs. member)
-- ----------------------------------------------------------------------------
-- Feed posts are published by staff but speak for the club, not the individual
-- who happened to hit "Publish." `author_type` records whose voice a post is in:
--   'club'   — an official announcement, shown as "Starkville Country Club"
--              with the SCC mark
--   'member' — a personal post, shown with the member's own name + avatar
-- `author_id` still records the real publisher and RLS ownership is unchanged;
-- this column only governs how the byline renders. Every existing post is a club
-- announcement, so the column is `not null default 'club'`, which backfills all
-- existing rows to club-authored. Idempotent.
-- ============================================================================
do $$ begin
  create type public.post_author_type as enum ('club', 'member');
exception when duplicate_object then null; end $$;

alter table public.posts
  add column if not exists author_type public.post_author_type not null default 'club';
