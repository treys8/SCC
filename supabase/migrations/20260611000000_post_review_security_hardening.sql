-- ============================================================================
-- Security & correctness hardening (post-review).
--
-- Bundles the database-side fixes from the 8-reviewer audit:
--   1. profiles: stop leaking every member's email/phone/role via PostgREST.
--   2. member_cards view: the name+avatar subset members ARE allowed to see.
--   3. posts bucket: real server-side size/type limits + staff-only uploads.
--   4. notifications: members may flip is_read only, not rewrite the row.
--   5. set_member_department_preferences(): atomic opt-in replacement.
--   6. push_subscriptions.failure_count: backstop for pruning dead endpoints.
--   7. FK indexes the original schema omitted.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles SELECT — self or staff only (was USING (true), a PII directory).
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_self_or_staff" on public.profiles;
create policy "profiles_select_self_or_staff"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or private.current_user_role() in ('staff', 'admin')
  );

-- ----------------------------------------------------------------------------
-- 2. member_cards — the member-to-member display subset (name + avatar only).
--    Definer view (security_invoker = off) so it bypasses the restrictive
--    profiles policy above and exposes ONLY these three non-sensitive columns.
--    The feed resolves post authors through this (see src/lib/feed.ts).
-- ----------------------------------------------------------------------------
drop view if exists public.member_cards;
create view public.member_cards
  with (security_invoker = off) as
  select id, full_name, avatar_url
  from public.profiles;
-- A new view inherits Supabase's default ALL-grant to anon + authenticated.
-- Because this is a definer, auto-updatable view, that would let anon READ every
-- member and let authenticated WRITE profiles THROUGH the view (bypassing RLS).
-- Lock it to authenticated-SELECT only, immediately, so re-running this file in
-- isolation can never reopen that window. (20260611010000 reconciled the
-- already-applied DB, where this fold-in didn't yet exist.)
revoke all on public.member_cards from anon;
revoke all on public.member_cards from authenticated;
grant select on public.member_cards to authenticated;

-- ----------------------------------------------------------------------------
-- 3. posts storage bucket — enforce limits server-side (client checks are
--    bypassable via the Storage REST API) and restrict uploads to staff.
--    Size/types mirror src/lib/upload.ts (MAX_FILE_BYTES + ACCEPT_ATTR).
-- ----------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/heic', 'image/heif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv'
    ]
where id = 'posts';

-- Only staff/admin may write to the bucket (posts, event covers, attachments
-- are all staff-authored). Own-folder rule retained.
drop policy if exists "posts_bucket_insert_own" on storage.objects;
create policy "posts_bucket_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.current_user_role() in ('staff', 'admin')
  );

-- ----------------------------------------------------------------------------
-- 4. notifications UPDATE — column-level: members toggle is_read, nothing else.
--    The row-ownership policy (notifications_update_own) still applies.
-- ----------------------------------------------------------------------------
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Atomic department-preference replacement. Delete + insert in one
--    transaction so a failed insert can't leave a member with zero opt-ins.
-- ----------------------------------------------------------------------------
create or replace function public.set_member_department_preferences(
  p_departments public.department_type[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.member_department_preferences where user_id = uid;
  insert into public.member_department_preferences (user_id, department)
  select uid, d
  from unnest(coalesce(p_departments, array[]::public.department_type[])) as d
  on conflict (user_id, department) do nothing;
end;
$$;
revoke all on function public.set_member_department_preferences(public.department_type[])
  from public, anon;
grant execute on function public.set_member_department_preferences(public.department_type[])
  to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Push pruning backstop — count transient send failures so dead endpoints
--    can be pruned without nuking the table on a batch-wide VAPID (403) error.
-- ----------------------------------------------------------------------------
alter table public.push_subscriptions
  add column if not exists failure_count integer not null default 0;

-- ----------------------------------------------------------------------------
-- 7. Foreign-key indexes the original schema omitted.
-- ----------------------------------------------------------------------------
create index if not exists posts_author_id_idx
  on public.posts (author_id);
create index if not exists calendar_events_created_by_idx
  on public.calendar_events (created_by);
create index if not exists notifications_reservation_id_idx
  on public.notifications (reservation_id);
