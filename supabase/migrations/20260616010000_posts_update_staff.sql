-- ============================================================================
-- SCC — Let staff/admin update ANY post (e.g. pin a member's post to the feed).
--
-- The init policy `posts_update_author` restricts updates to author_id =
-- auth.uid(), so a staffer's pin of another member's post matched 0 rows and
-- surfaced the misleading "You can only pin your own posts." This adds a second,
-- permissive policy for staff/admin. Permissive policies are OR-ed, so members
-- keep editing their own posts and staff gain update (pin/unpin) on all posts.
-- Content-edit stays author-only at the app layer (updatePost checks authorship);
-- this only unblocks the pin write. Idempotent: safe to run more than once.
-- ============================================================================

drop policy if exists "posts_update_staff" on public.posts;
create policy "posts_update_staff"
  on public.posts for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );
