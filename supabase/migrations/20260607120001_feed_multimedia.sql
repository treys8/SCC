-- ============================================================================
-- SCC feed — multimedia attachments, optional titles, realtime.
--
-- Turns posts into a modern broadcast feed: a post may carry many photos and
-- many documents (a new `post_attachments` table), the title becomes optional
-- (caption-only posts are allowed), and new posts are streamed to clients via
-- Supabase Realtime.
--
-- Depends on 20260607120000_feed_department_categories.sql.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------- Posts: allow caption-only posts (title optional) ----------
-- The server action still enforces "a post needs a title, body, or at least
-- one attachment"; the column itself no longer requires a title.
alter table public.posts alter column title drop not null;

-- ---------- Attachment kind enum ----------
do $$ begin
  create type public.attachment_kind as enum ('image', 'file');
exception when duplicate_object then null; end $$;

-- ---------- post_attachments ----------
-- One row per uploaded file. `storage_path` is retained so the object can be
-- removed from Storage when an attachment or its post is deleted. `width`/
-- `height` (images only) feed next/image so the gallery reserves the right
-- aspect ratio and avoids layout shift. `position` orders files within a post.
create table if not exists public.post_attachments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts(id) on delete cascade,
  kind          public.attachment_kind not null,
  url           text not null,
  storage_path  text not null,
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  width         integer,
  height        integer,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists post_attachments_post_idx
  on public.post_attachments (post_id, position);

-- ============================================================================
-- Row-Level Security (mirrors the posts policies)
-- ============================================================================
alter table public.post_attachments enable row level security;

grant select, insert, update, delete on public.post_attachments to authenticated;

-- Anyone authenticated may read attachments (same as posts_select_authenticated).
drop policy if exists "post_attachments_select_authenticated" on public.post_attachments;
create policy "post_attachments_select_authenticated"
  on public.post_attachments for select to authenticated using (true);

-- Staff/admin may attach files only to a post they authored.
drop policy if exists "post_attachments_insert_own_post" on public.post_attachments;
create policy "post_attachments_insert_own_post"
  on public.post_attachments for insert to authenticated
  with check (
    private.current_user_role() in ('staff', 'admin')
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = (select auth.uid())
    )
  );

-- The post's author may remove its attachments.
drop policy if exists "post_attachments_delete_own_post" on public.post_attachments;
create policy "post_attachments_delete_own_post"
  on public.post_attachments for delete to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = (select auth.uid())
    )
  );

-- No update policy by design: attachments are immutable. Changing files means
-- deleting the old rows/objects and inserting new ones.

-- ============================================================================
-- Backfill: fold any legacy single image/pdf into post_attachments so the new
-- UI renders historical posts. Idempotent — only inserts when absent. The
-- legacy posts.image_url / posts.pdf_url columns are left in place but unused.
-- ============================================================================
insert into public.post_attachments (post_id, kind, url, storage_path, position)
select p.id,
       'image'::public.attachment_kind,
       p.image_url,
       split_part(p.image_url, '/storage/v1/object/public/posts/', 2),
       0
from public.posts p
where p.image_url is not null
  and not exists (
    select 1 from public.post_attachments a
    where a.post_id = p.id and a.kind = 'image'
  );

insert into public.post_attachments (post_id, kind, url, storage_path, file_name, position)
select p.id,
       'file'::public.attachment_kind,
       p.pdf_url,
       split_part(p.pdf_url, '/storage/v1/object/public/posts/', 2),
       'attachment.pdf',
       1
from public.posts p
where p.pdf_url is not null
  and not exists (
    select 1 from public.post_attachments a
    where a.post_id = p.id and a.kind = 'file'
  );

-- ============================================================================
-- Realtime: stream new posts to subscribed clients (INSERT events). RLS still
-- gates delivery, and posts are readable by every authenticated member.
-- ============================================================================
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;
