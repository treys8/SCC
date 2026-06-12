-- ============================================================================
-- SCC — Member accounts + staff titles.
--
-- The club account number is the basis of every membership. It is assigned by
-- staff (NOT auto-generated) and stored as TEXT because legacy numbers carry
-- leading zeros ('00123' is a different account than '123'). One account holds
-- one or more logins: a household is typically two profiles (spouses), each
-- with their own email and password, sharing one account number.
--
--   * accounts      — one row per club account; the number itself is the key.
--   * staff_titles  — extensible lookup (NOT an enum: titles change as staff
--                     turn over). max_holders caps how many profiles may hold
--                     a title at once: NULL = unlimited, 1 = singleton (the
--                     General Manager is CEO-style, exactly one person).
--   * profiles      — gains nullable account_number (members) and title_id
--                     (staff). Both protected from member self-edits by a
--                     trigger, mirroring enforce_role_change: the
--                     "update own profile" RLS policy would otherwise let a
--                     member rewrite their own account number.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---- accounts --------------------------------------------------------------
create table if not exists public.accounts (
  account_number text primary key
    check (account_number ~ '^[0-9]{1,5}$'),
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id) on delete set null
);

-- ---- staff_titles (+seed) --------------------------------------------------
create table if not exists public.staff_titles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  department  public.department_type not null,
  max_holders integer check (max_holders is null or max_holders >= 1),
  created_at  timestamptz not null default now()
);

insert into public.staff_titles (name, department, max_holders)
values
  ('General Manager',               'general', 1),
  ('Membership Director',           'general', null),
  ('Office Assistant',              'general', null),
  ('Director of Golf',              'golf',    null),
  ('Assistant Golf Professional',   'golf',    null),
  ('Golf Course Superintendent',    'golf',    null),
  ('Head Chef and Kitchen Manager', 'dining',  null),
  ('Front of House Manager',        'dining',  null)
on conflict (name) do nothing;

-- ---- profiles columns ------------------------------------------------------
alter table public.profiles
  add column if not exists account_number text
    references public.accounts(account_number) on delete set null,
  add column if not exists title_id uuid
    references public.staff_titles(id) on delete set null;

create index if not exists profiles_account_number_idx
  on public.profiles (account_number);
create index if not exists profiles_title_id_idx
  on public.profiles (title_id);

-- ---- cap concurrent holders of a title (General Manager = 1) ----------------
-- Locks the staff_titles row so two simultaneous assignments serialize instead
-- of both passing the count check.
create or replace function public.enforce_title_max_holders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max   integer;
  v_count integer;
begin
  if new.title_id is not null
     and (tg_op = 'INSERT' or new.title_id is distinct from old.title_id) then
    select max_holders into v_max
      from public.staff_titles
      where id = new.title_id
      for update;
    if v_max is not null then
      select count(*) into v_count
        from public.profiles
        where title_id = new.title_id and id <> new.id;
      if v_count >= v_max then
        raise exception 'This title is limited to % holder(s) and is already filled', v_max;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_title_max_holders() from public, anon, authenticated;

drop trigger if exists enforce_title_max_holders_trg on public.profiles;
create trigger enforce_title_max_holders_trg
  before insert or update on public.profiles
  for each row execute function public.enforce_title_max_holders();

-- ---- protect account_number / title_id from member self-edits ---------------
-- Mirrors enforce_role_change: the service-role client (auth.uid() is null)
-- always passes; account_number may also be set by staff/admin sessions;
-- title_id only by admins (titles travel with staff role grants, admin-only).
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
  return new;
end;
$$;
revoke all on function public.enforce_protected_profile_columns() from public, anon, authenticated;

drop trigger if exists enforce_protected_profile_columns_trg on public.profiles;
create trigger enforce_protected_profile_columns_trg
  before update on public.profiles
  for each row execute function public.enforce_protected_profile_columns();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.accounts     enable row level security;
alter table public.staff_titles enable row level security;

grant select, insert, update, delete on public.accounts     to authenticated;
grant select, insert, update, delete on public.staff_titles to authenticated;

-- ---- accounts: staff/admin read all; members read their own account ----
drop policy if exists "accounts_select_own_or_staff" on public.accounts;
create policy "accounts_select_own_or_staff"
  on public.accounts for select to authenticated
  using (
    private.current_user_role() in ('staff', 'admin')
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.account_number = accounts.account_number
    )
  );

drop policy if exists "accounts_insert_staff_admin" on public.accounts;
create policy "accounts_insert_staff_admin"
  on public.accounts for insert to authenticated
  with check ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "accounts_update_staff_admin" on public.accounts;
create policy "accounts_update_staff_admin"
  on public.accounts for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "accounts_delete_admin" on public.accounts;
create policy "accounts_delete_admin"
  on public.accounts for delete to authenticated
  using ( private.current_user_role() = 'admin' );

-- ---- staff_titles: everyone reads (shown on profiles); admins manage ----
drop policy if exists "staff_titles_select_authenticated" on public.staff_titles;
create policy "staff_titles_select_authenticated"
  on public.staff_titles for select to authenticated using (true);

drop policy if exists "staff_titles_insert_admin" on public.staff_titles;
create policy "staff_titles_insert_admin"
  on public.staff_titles for insert to authenticated
  with check ( private.current_user_role() = 'admin' );

drop policy if exists "staff_titles_update_admin" on public.staff_titles;
create policy "staff_titles_update_admin"
  on public.staff_titles for update to authenticated
  using      ( private.current_user_role() = 'admin' )
  with check ( private.current_user_role() = 'admin' );

drop policy if exists "staff_titles_delete_admin" on public.staff_titles;
create policy "staff_titles_delete_admin"
  on public.staff_titles for delete to authenticated
  using ( private.current_user_role() = 'admin' );
