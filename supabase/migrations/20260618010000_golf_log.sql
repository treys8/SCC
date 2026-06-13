-- ============================================================================
-- SCC — Golf Course Superintendent daily log
--
-- A dated log the superintendent keeps from his phone or the web: "done"
-- accomplishments and "issue" items (issues stay open until resolved). It is
-- private to course leadership — the General Manager and the Director of Golf can
-- read every entry and comment back; no members and no other staff can see it.
--
--   * golf_log_entries   — one row per logged item, dated, kind = done | issue.
--   * golf_log_comments  — leadership (or the author) replies on an entry.
--   * private.current_user_title() — the caller's staff title, for RLS. Mirrors
--                          private.current_user_role(): SECURITY DEFINER so a
--                          policy can read staff_titles regardless of caller.
--
-- Builds on 20260607000000_init.sql (profiles, private schema,
-- update_updated_at_column) and 20260617000000 (staff_titles). Idempotent.
-- ============================================================================

-- ---- caller's staff title (NULL for members / titleless staff) -------------
create or replace function private.current_user_title()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.name
  from public.profiles p
  join public.staff_titles t on t.id = p.title_id
  where p.id = (select auth.uid())
$$;
revoke all on function private.current_user_title() from public, anon;
grant execute on function private.current_user_title() to authenticated;

-- ---- golf_log_entries ------------------------------------------------------
create table if not exists public.golf_log_entries (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  entry_date  date not null default (now() at time zone 'America/Chicago')::date,
  kind        text not null check (kind in ('done', 'issue')),
  area        text,
  note        text not null check (length(note) between 1 and 2000),
  photo_url   text,
  resolved    boolean not null default false,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Newest first for the day view; open issues carried forward across days.
create index if not exists golf_log_entries_date_idx
  on public.golf_log_entries (entry_date desc, created_at desc);
create index if not exists golf_log_entries_open_idx
  on public.golf_log_entries (resolved, kind);

drop trigger if exists update_golf_log_entries_updated_at on public.golf_log_entries;
create trigger update_golf_log_entries_updated_at
  before update on public.golf_log_entries
  for each row execute function public.update_updated_at_column();

-- ---- golf_log_comments -----------------------------------------------------
create table if not exists public.golf_log_comments (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.golf_log_entries(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists golf_log_comments_entry_idx
  on public.golf_log_comments (entry_id, created_at);

-- ============================================================================
-- Row-Level Security — author + course leadership (GM, Director of Golf) only;
-- admins are the catch-all operator. Members and unrelated staff see nothing.
-- ============================================================================
alter table public.golf_log_entries  enable row level security;
alter table public.golf_log_comments enable row level security;

grant select, insert, update, delete on public.golf_log_entries  to authenticated;
grant select, insert, delete         on public.golf_log_comments to authenticated;

-- ---- entries: who can read ----
drop policy if exists "golf_log_entries_select_leadership" on public.golf_log_entries;
create policy "golf_log_entries_select_leadership"
  on public.golf_log_entries for select to authenticated
  using (
    author_id = (select auth.uid())
    or private.current_user_role() = 'admin'
    or private.current_user_title() in ('General Manager', 'Director of Golf')
  );

-- ---- entries: only the superintendent (or admin) logs, and only as self ----
drop policy if exists "golf_log_entries_insert_superintendent" on public.golf_log_entries;
create policy "golf_log_entries_insert_superintendent"
  on public.golf_log_entries for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      private.current_user_role() = 'admin'
      or private.current_user_title() = 'Golf Course Superintendent'
    )
  );

-- ---- entries: author (or admin) edits / resolves / deletes ----
drop policy if exists "golf_log_entries_update_author" on public.golf_log_entries;
create policy "golf_log_entries_update_author"
  on public.golf_log_entries for update to authenticated
  using      ( author_id = (select auth.uid()) or private.current_user_role() = 'admin' )
  with check ( author_id = (select auth.uid()) or private.current_user_role() = 'admin' );

drop policy if exists "golf_log_entries_delete_author" on public.golf_log_entries;
create policy "golf_log_entries_delete_author"
  on public.golf_log_entries for delete to authenticated
  using ( author_id = (select auth.uid()) or private.current_user_role() = 'admin' );

-- ---- comments: readable to whoever can read the parent entry ----
drop policy if exists "golf_log_comments_select_visible" on public.golf_log_comments;
create policy "golf_log_comments_select_visible"
  on public.golf_log_comments for select to authenticated
  using (
    exists (
      select 1 from public.golf_log_entries e
      where e.id = golf_log_comments.entry_id
        and (
          e.author_id = (select auth.uid())
          or private.current_user_role() = 'admin'
          or private.current_user_title() in ('General Manager', 'Director of Golf')
        )
    )
  );

-- ---- comments: leadership or the entry's author may reply, only as self ----
drop policy if exists "golf_log_comments_insert_leadership_or_author" on public.golf_log_comments;
create policy "golf_log_comments_insert_leadership_or_author"
  on public.golf_log_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.golf_log_entries e
      where e.id = golf_log_comments.entry_id
        and (
          e.author_id = (select auth.uid())
          or private.current_user_role() = 'admin'
          or private.current_user_title() in ('General Manager', 'Director of Golf')
        )
    )
  );

drop policy if exists "golf_log_comments_delete_author" on public.golf_log_comments;
create policy "golf_log_comments_delete_author"
  on public.golf_log_comments for delete to authenticated
  using ( author_id = (select auth.uid()) or private.current_user_role() = 'admin' );
