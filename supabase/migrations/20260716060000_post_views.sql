-- ============================================================================
-- SCC — post reach ("seen by N members").
--
-- Staff write into a void: /manage/analytics knows how many members opened the
-- app, but nothing about whether any given post was actually read. Without that
-- there's no way to learn what lands — which is the whole argument for the feed
-- over the incumbent's one-way text blast.
--
-- A view is recorded when a post actually scrolls into a member's viewport (an
-- IntersectionObserver in the feed), not when a page merely renders it. Counting
-- renders would inflate every number by whatever happened to be below the fold;
-- this way "seen by 62" means 62 people had it on screen.
--
-- One row per (post, member) — the PK is the dedupe, so a member re-reading a
-- post never double-counts and the table stays bounded by posts × members. The
-- client also dedupes per session, so the RPC is rarely called twice for the
-- same row anyway.
--
-- Members never read this table: reach is staff intelligence, and a member
-- seeing who read what is a different (and unwanted) product. The only policy is
-- staff/admin select. Writes go exclusively through record_post_views(), the
-- same shape as touch_last_seen: security definer, locked search_path, so
-- members need no write grant on the table at all.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.post_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

comment on table public.post_views is
  'One row per member per post actually scrolled into view. Staff-read only; written exclusively via record_post_views(). The PK dedupes, so a re-read never double-counts.';

-- "Views in the last 30 days" on the analytics page scans by time.
create index if not exists post_views_seen_at_idx on public.post_views (seen_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.post_views enable row level security;

-- Reads only, and only for staff — writes happen via the definer RPC below.
grant select on public.post_views to authenticated;

drop policy if exists "post_views_select_staff_admin" on public.post_views;
create policy "post_views_select_staff_admin"
  on public.post_views for select to authenticated
  using ( private.current_user_role() in ('staff', 'admin') );

-- ── Recording RPC ────────────────────────────────────────────────────────────
-- Takes the batch the feed observed. Guards, in order: signed-in only; a bounded
-- batch (a page of feed is ~10, so 50 is generous and caps a crafted call); and
-- only ids that are really published posts — the insert...select is what makes
-- an arbitrary uuid a no-op rather than a row. on conflict do nothing means
-- re-sends are free.
create or replace function public.record_post_views(p_post_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  if array_length(p_post_ids, 1) is null or array_length(p_post_ids, 1) > 50 then
    return;
  end if;

  insert into public.post_views (post_id, user_id)
  select p.id, uid
  from public.posts p
  where p.id = any(p_post_ids)
    and p.status = 'published'
  on conflict (post_id, user_id) do nothing;
end;
$$;

revoke all on function public.record_post_views(uuid[]) from public, anon;
grant execute on function public.record_post_views(uuid[]) to authenticated;

-- ── Reading the reach ────────────────────────────────────────────────────────
-- Both of these aggregate in SQL rather than shipping rows to be counted in JS.
-- That isn't only tidier: PostgREST caps a response at max-rows (1000 by
-- default), so counting client-side would silently truncate — a well-read post
-- would report "Not seen yet", and the 30-day total would plateau at exactly
-- 1000 — and present it as fact. Aggregates return one row per post (or one row
-- flat), so there's nothing to truncate.
--
-- Deliberately SECURITY INVOKER (the default, stated for emphasis): post_views'
-- staff-only select policy then applies to the caller, so a member calling
-- these gets zeros rather than the club's reading habits. No definer needed —
-- there's nothing here a staffer couldn't select themselves.

/** Views per post, for the ids given. Members get nothing (RLS). */
create or replace function public.get_post_view_counts(p_post_ids uuid[])
returns table (post_id uuid, views integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select pv.post_id, count(*)::integer
  from public.post_views pv
  where pv.post_id = any(p_post_ids)
  group by pv.post_id;
$$;

revoke all on function public.get_post_view_counts(uuid[]) from public, anon;
grant execute on function public.get_post_view_counts(uuid[]) to authenticated;

/** Distinct readers + total reads since an instant. Members get zeros (RLS). */
create or replace function public.get_post_view_stats(p_since timestamptz)
returns table (readers integer, views integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(distinct pv.user_id)::integer,
    count(*)::integer
  from public.post_views pv
  where pv.seen_at >= p_since;
$$;

revoke all on function public.get_post_view_stats(timestamptz) from public, anon;
grant execute on function public.get_post_view_stats(timestamptz) to authenticated;
