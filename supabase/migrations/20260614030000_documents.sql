-- ============================================================================
-- SCC — Document library (menus, pool info, newsletters).
--
-- Staff upload the club's already-branded PDFs/images; members browse and
-- download them, grouped by category. Each row is a single file. Storage and
-- limits mirror the hardened `posts` bucket so the same upload pipeline
-- (lib/upload.ts) and client validation work unchanged.
--
--   * category   — text + CHECK (not an enum) so categories can be added later
--                  without `alter type`. Label map lives in src/lib/constants.ts.
--   * file_*     — the uploaded object: public URL, storage path, name, mime, size.
--   * cover_image_url — reserved for an optional thumbnail; image documents can
--                  render their own file as the thumb, so it seeds null for now.
--   * is_published — staff can stage a document before members see it.
--   * sort_order — display order within a category.
--
-- RLS: members read PUBLISHED rows (staff/admin read all); staff/admin write.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ── Storage bucket (public; mirrors the posts bucket's size + mime allow-list) ─
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', true, 26214400, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read needs no SELECT policy (and omitting it stops bucket listing).
-- Writes: staff/admin only, to their own <uid>/ folder (mirrors posts).
drop policy if exists "documents_bucket_insert_own" on storage.objects;
create policy "documents_bucket_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.current_user_role() in ('staff', 'admin')
  );

drop policy if exists "documents_bucket_update_own" on storage.objects;
create policy "documents_bucket_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "documents_bucket_delete_own" on storage.objects;
create policy "documents_bucket_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ── Table ────────────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  category        text not null default 'general'
                    check (category in ('menu', 'pool', 'newsletter', 'form', 'general')),
  file_url        text not null,
  storage_path    text not null,
  file_name       text,
  mime_type       text,
  size_bytes      bigint,
  cover_image_url text,
  is_published    boolean not null default true,
  sort_order      integer not null default 0,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists documents_category_idx on public.documents (category, sort_order);
create index if not exists documents_published_idx on public.documents (is_published) where is_published;

drop trigger if exists update_documents_updated_at on public.documents;
create trigger update_documents_updated_at
  before update on public.documents
  for each row execute function public.update_updated_at_column();

-- ── Row-Level Security ───────────────────────────────────────────────────────
alter table public.documents enable row level security;

grant select, insert, update, delete on public.documents to authenticated;

-- Members read published rows; staff/admin see everything (incl. staged drafts).
drop policy if exists "documents_select" on public.documents;
create policy "documents_select"
  on public.documents for select to authenticated
  using (
    is_published or private.current_user_role() in ('staff', 'admin')
  );

drop policy if exists "documents_insert_staff_admin" on public.documents;
create policy "documents_insert_staff_admin"
  on public.documents for insert to authenticated
  with check (
    private.current_user_role() in ('staff', 'admin')
    and created_by = (select auth.uid())
  );

drop policy if exists "documents_update_staff_admin" on public.documents;
create policy "documents_update_staff_admin"
  on public.documents for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "documents_delete_staff_admin" on public.documents;
create policy "documents_delete_staff_admin"
  on public.documents for delete to authenticated
  using ( private.current_user_role() in ('staff', 'admin') );
