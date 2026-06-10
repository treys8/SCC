-- ============================================================================
-- Flip member_department_preferences from opt-IN to opt-OUT storage.
--
-- A row now means "do NOT alert me about this department." No rows = receive
-- everything (default-on); a fully-opted-out member has one row per department.
-- This lets a member who unchecks every box actually receive nothing — the
-- opt-in model collapsed that to "never configured → default-on."
--
-- The one-time data flip below is run-once via the migration history (it is not
-- itself re-runnable); the RPC change is idempotent (create or replace).
-- ============================================================================

-- 1. One-time data flip. A member who had opted INTO a subset wanted only those,
--    which under opt-out storage is opting OUT of the rest. Members with no rows
--    stay default-on (no rows). No-op when the table is empty.
create temporary table _mdp_optouts on commit drop as
  select c.user_id, d.dept as department
  from (select distinct user_id from public.member_department_preferences) c
  cross join (
    select unnest(enum_range(null::public.department_type)) as dept
  ) d
  where not exists (
    select 1 from public.member_department_preferences m
    where m.user_id = c.user_id and m.department = d.dept
  );
delete from public.member_department_preferences;
insert into public.member_department_preferences (user_id, department)
  select user_id, department from _mdp_optouts;

-- 2. The RPC now receives the departments the member WANTS and stores the
--    COMPLEMENT as opt-out rows. (create or replace preserves the existing
--    grants set in 20260611000000.)
create or replace function public.set_member_department_preferences(
  p_departments public.department_type[] -- departments the member wants to keep
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
  from unnest(enum_range(null::public.department_type)) as d
  where d <> all (coalesce(p_departments, array[]::public.department_type[]))
  on conflict (user_id, department) do nothing;
end;
$$;

comment on table public.member_department_preferences is
  'Opt-OUT rows: (user_id, department) means do NOT alert that member about that '
  'department. A member with no rows receives everything (default-on).';
