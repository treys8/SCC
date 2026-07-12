-- Post drafts & scheduled publishing.
--
-- Until now every post went live the instant it was inserted — there was no way
-- for staff to save a draft or line up an announcement for later. This adds a
-- lifecycle to posts:
--   'draft'     — saved privately, hidden from members, editable in /manage.
--   'scheduled' — has a publish_at; a cron flips it to 'published' once due.
--   'published' — live on the member feed (the default, so every existing row
--                 and every plain insert keeps today's behaviour).
--
-- Feed ordering is keyset on created_at, so when a draft/scheduled post goes
-- live the publisher (the updatePost action or the cron) bumps created_at to
-- now() — that's app logic, not stored here, so this migration only adds state.
--
-- Idempotent: safe to run more than once.

alter table public.posts
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'scheduled', 'published'));

alter table public.posts
  add column if not exists publish_at timestamptz;

comment on column public.posts.status is
  'Post lifecycle: draft (hidden from members), scheduled (publishes at publish_at via cron), or published (live). Defaults to published.';
comment on column public.posts.publish_at is
  'For scheduled posts, the club time the post should go live. NULL for drafts and published posts.';

-- The cron scans for due scheduled posts; a partial index keeps that cheap and
-- skips the (vast) non-scheduled majority.
create index if not exists posts_scheduled_publish_at_idx
  on public.posts (publish_at)
  where status = 'scheduled';

-- Members may only read published posts; staff/admin keep full read access so
-- the /manage console can list drafts and scheduled posts. This is the primary
-- guard — it also hides not-yet-live rows from the realtime INSERT socket (which
-- is RLS-gated by the member's JWT) and from the /reservations required-date
-- lookup, both of which read posts through the member's authenticated client.
drop policy if exists "posts_select_authenticated" on public.posts;
create policy "posts_select_authenticated"
  on public.posts for select to authenticated
  using (
    status = 'published'
    or private.current_user_role() in ('staff', 'admin')
  );
