-- ============================================================================
-- SCC — Deactivating a login (staff turnover) without losing their history.
--
-- The only way to take someone out was "Remove", which deletes the auth user —
-- and profiles → posts / golf_course_log / … are ON DELETE CASCADE, so removing
-- a departed manager would erase every post they wrote. Deactivating keeps the
-- person and their history and switches off their access:
--
--   profiles.deactivated_at — set by the server (service role) only. The app
--     also bans the auth user (no sign-in, no token refresh) and clears their
--     staff title so it can be reassigned.
--   private.current_user_role() — returns NULL for a deactivated profile, so an
--     access token issued before the ban (valid up to its expiry) stops passing
--     every staff/admin RLS check immediately.
--   member_cards.title — "Former staff" for a deactivated staff/admin author,
--     so old posts read "Posted by Name · Former staff". The title itself goes
--     to whoever holds it now.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

alter table public.profiles
  add column if not exists deactivated_at timestamptz;

comment on column public.profiles.deactivated_at is
  'When this login was deactivated (auth user banned, staff title cleared). NULL = active. Server-only (enforce_protected_profile_columns).';

-- ---- role resolution: a deactivated profile holds no role --------------------
create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
    from public.profiles
   where id = auth.uid()
     and deactivated_at is null
$$;
revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_user_role() to authenticated;

-- ---- protect deactivated_at (plus the existing account/title guards) -------
create or replace function public.enforce_protected_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_number is distinct from old.account_number then
    if auth.uid() is null
       or private.current_user_role() in ('staff', 'admin') then
      null;
    else
      raise exception 'Only staff can change an account number';
    end if;
  end if;
  if new.title_id is distinct from old.title_id then
    if auth.uid() is null
       or private.current_user_role() = 'admin' then
      null;
    else
      raise exception 'Only admins can change a staff title';
    end if;
  end if;
  -- Deactivation also bans the auth user, which only the service role can do,
  -- so the column is service-role-only too: the two must never disagree.
  if new.deactivated_at is distinct from old.deactivated_at then
    if auth.uid() is not null then
      raise exception 'Deactivation is managed by the server';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_protected_profile_columns() from public, anon, authenticated;

-- ---- member_cards: "Former staff" byline ------------------------------------
-- Same columns, names and types as 20260619010000 (definer view,
-- authenticated-SELECT only), so CREATE OR REPLACE applies in place and the
-- view keeps its grants; they're re-asserted below anyway.
create or replace view public.member_cards
  with (security_invoker = off) as
  select p.id,
         p.full_name,
         p.avatar_url,
         case
           when p.deactivated_at is not null and p.role in ('staff', 'admin')
             then 'Former staff'
           else t.name
         end as title
  from public.profiles p
  left join public.staff_titles t on t.id = p.title_id;

revoke all on public.member_cards from anon;
revoke all on public.member_cards from authenticated;
grant select on public.member_cards to authenticated;
