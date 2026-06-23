-- ============================================================================
-- SCC — Page sections: staff-editable content blocks for member info pages.
--
-- A small, reusable "page CMS" so the Dining and Pool destination pages have a
-- home for free-text content (hours, dress code, guest rules, season, …) without
-- a migration per section. Each row is one ordered, publishable block scoped to a
-- page. The same shape powers both pages and any future info page (just widen the
-- `page` check), and one editor component edits them all.
--
--   * page         — which member page this block belongs to ('dining' | 'pool').
--   * heading       — the section title (e.g. "Hours", "Guest policy").
--   * body          — free text; rendered with whitespace-pre-wrap (no markdown),
--                     the same convention as post bodies and event descriptions.
--   * sort_order    — ascending display order within a page.
--   * is_published  — staff draft a section before members see it. Members read
--                     published only; staff/admin read all (drafts included).
--
-- RLS mirrors documents: members read published rows; staff/admin do everything.
-- Seeded with an unpublished scaffold so staff have headings to fill in; the
-- member pages stay empty until something is published. Idempotent.
-- ============================================================================

create table if not exists public.page_sections (
  id           uuid primary key default gen_random_uuid(),
  page         text not null check (page in ('dining', 'pool')),
  heading      text not null,
  body         text not null default '',
  sort_order   integer not null default 0,
  is_published boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null
);

create index if not exists page_sections_page_order_idx
  on public.page_sections (page, sort_order);

-- Unpublished starter headings, only when the table is empty (re-run safe).
insert into public.page_sections (page, heading, sort_order, is_published)
select v.page, v.heading, v.sort_order, false
from (values
  ('dining', 'Hours', 0),
  ('dining', 'Dress code', 1),
  ('dining', 'Reservations', 2),
  ('pool', 'Hours', 0),
  ('pool', 'Season', 1),
  ('pool', 'Guest policy', 2)
) as v(page, heading, sort_order)
where not exists (select 1 from public.page_sections);

drop trigger if exists update_page_sections_updated_at on public.page_sections;
create trigger update_page_sections_updated_at
  before update on public.page_sections
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.page_sections enable row level security;

grant select, insert, update, delete on public.page_sections to authenticated;

-- ---- members read published; staff/admin read all (drafts included) ----
drop policy if exists "page_sections_select" on public.page_sections;
create policy "page_sections_select"
  on public.page_sections for select to authenticated
  using (
    is_published
    or private.current_user_role() in ('staff', 'admin')
  );

-- ---- staff/admin write (insert / update / delete) ----
drop policy if exists "page_sections_insert_staff_admin" on public.page_sections;
create policy "page_sections_insert_staff_admin"
  on public.page_sections for insert to authenticated
  with check ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "page_sections_update_staff_admin" on public.page_sections;
create policy "page_sections_update_staff_admin"
  on public.page_sections for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "page_sections_delete_staff_admin" on public.page_sections;
create policy "page_sections_delete_staff_admin"
  on public.page_sections for delete to authenticated
  using ( private.current_user_role() in ('staff', 'admin') );
