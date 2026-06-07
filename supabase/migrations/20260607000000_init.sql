-- ============================================================================
-- Starkville Country Club — initial schema (final, hardened state)
-- Postgres / Supabase. Idempotent: safe to run more than once.
--
-- Apply via the Supabase SQL Editor, or with the CLI:
--   supabase db push
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;          -- gen_random_uuid()

-- ---------- Private schema (not exposed to the REST API) ----------
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------- Enums ----------
do $$ begin
  create type public.user_role as enum ('member', 'staff', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.department_type as enum ('golf', 'dining', 'tennis', 'general');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        public.user_role not null default 'member',
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  department  public.department_type not null,
  title       text not null,
  content     text not null,
  image_url   text,
  pdf_url     text,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists posts_department_idx on public.posts (department);
create index if not exists posts_created_at_idx  on public.posts (created_at desc);
create index if not exists posts_pinned_idx      on public.posts (is_pinned) where is_pinned;

create table if not exists public.reservations (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references public.profiles(id) on delete cascade,
  reservation_date  date not null,
  reservation_time  time not null,
  party_size        integer not null check (party_size > 0),
  special_requests  text,
  status            text not null default 'pending'
                      check (status in ('pending', 'confirmed', 'cancelled')),
  created_at        timestamptz not null default now()
);
create index if not exists reservations_member_idx on public.reservations (member_id);
create index if not exists reservations_date_idx   on public.reservations (reservation_date);

create table if not exists public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  event_date   date not null,
  start_time   time not null,
  end_time     time,
  location     text,
  department   public.department_type,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists calendar_events_date_idx on public.calendar_events (event_date);

-- ============================================================================
-- Functions & triggers
-- ============================================================================

-- Current user's role. Lives in the private (non-API) schema so it is never
-- exposed as an RPC endpoint. SECURITY DEFINER so RLS policies can call it
-- without recursing through profiles' own policies; only ever returns the
-- caller's own role.
create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;
revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_user_role() to authenticated;

-- Touch updated_at on row update.
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_posts_updated_at on public.posts;
create trigger update_posts_updated_at
  before update on public.posts
  for each row execute function public.update_updated_at_column();

-- Create a profiles row whenever an auth user is created (invite or signup).
-- Role is ALWAYS 'member' here — never trust user-supplied metadata for role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins (or trusted server code with no JWT, i.e. the service-role
-- client) may change a profile's role — closes the privilege-escalation hole
-- in the "update own profile" policy.
create or replace function public.enforce_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is null then
      return new;                                  -- service role / trusted server
    elsif private.current_user_role() = 'admin' then
      return new;                                  -- an admin via a normal session
    else
      raise exception 'Only admins can change a user role';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_role_change() from public, anon, authenticated;

drop trigger if exists enforce_role_change_trg on public.profiles;
create trigger enforce_role_change_trg
  before update on public.profiles
  for each row execute function public.enforce_role_change();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.posts           enable row level security;
alter table public.reservations    enable row level security;
alter table public.calendar_events enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.profiles, public.posts, public.reservations, public.calendar_events
  to authenticated;

-- ---- profiles ----
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using  ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

-- ---- posts ----
drop policy if exists "posts_select_authenticated" on public.posts;
create policy "posts_select_authenticated"
  on public.posts for select to authenticated using (true);

drop policy if exists "posts_insert_staff_admin" on public.posts;
create policy "posts_insert_staff_admin"
  on public.posts for insert to authenticated
  with check (
    private.current_user_role() in ('staff', 'admin')
    and author_id = (select auth.uid())
  );

drop policy if exists "posts_update_author" on public.posts;
create policy "posts_update_author"
  on public.posts for update to authenticated
  using  ( author_id = (select auth.uid()) )
  with check ( author_id = (select auth.uid()) );

drop policy if exists "posts_delete_author" on public.posts;
create policy "posts_delete_author"
  on public.posts for delete to authenticated
  using ( author_id = (select auth.uid()) );

-- ---- reservations ----
drop policy if exists "reservations_select_own_or_staff" on public.reservations;
create policy "reservations_select_own_or_staff"
  on public.reservations for select to authenticated
  using (
    member_id = (select auth.uid())
    or private.current_user_role() in ('staff', 'admin')
  );

drop policy if exists "reservations_insert_own" on public.reservations;
create policy "reservations_insert_own"
  on public.reservations for insert to authenticated
  with check ( member_id = (select auth.uid()) );

drop policy if exists "reservations_update_own_or_staff" on public.reservations;
create policy "reservations_update_own_or_staff"
  on public.reservations for update to authenticated
  using (
    member_id = (select auth.uid())
    or private.current_user_role() in ('staff', 'admin')
  )
  with check (
    member_id = (select auth.uid())
    or private.current_user_role() in ('staff', 'admin')
  );

-- ---- calendar_events ----
drop policy if exists "events_select_authenticated" on public.calendar_events;
create policy "events_select_authenticated"
  on public.calendar_events for select to authenticated using (true);

drop policy if exists "events_insert_staff_admin" on public.calendar_events;
create policy "events_insert_staff_admin"
  on public.calendar_events for insert to authenticated
  with check ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "events_update_staff_admin" on public.calendar_events;
create policy "events_update_staff_admin"
  on public.calendar_events for update to authenticated
  using  ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "events_delete_staff_admin" on public.calendar_events;
create policy "events_delete_staff_admin"
  on public.calendar_events for delete to authenticated
  using ( private.current_user_role() in ('staff', 'admin') );

-- ============================================================================
-- Storage: public 'posts' bucket. Files are served via their public URL;
-- no SELECT policy is needed (and omitting it prevents clients from listing
-- the whole bucket). Users may write only to their own uid-named folder.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do nothing;

drop policy if exists "posts_bucket_insert_own" on storage.objects;
create policy "posts_bucket_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "posts_bucket_update_own" on storage.objects;
create policy "posts_bucket_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "posts_bucket_delete_own" on storage.objects;
create policy "posts_bucket_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
