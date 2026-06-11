-- ============================================================================
-- SCC — Administrative staff directory.
--
-- The club's "meet the team / who to contact" directory members see. This is
-- curated content, NOT auth state, so it is deliberately separate from
-- public.profiles (login accounts): most of these people may never log in, and
-- the directory should read the same whether or not an account exists.
--
--   * full_name / title — as shown on the printed org sheet ("Scott Buntin, PGA",
--                         "General Manager & PGA Golf Professional").
--   * email / phone     — public contact info; email is optional (a future hire
--                         may have none yet), phone is reserved for later.
--   * department        — reuses the existing department_type enum so the
--                         directory can be grouped/filtered like posts & events.
--                         Leadership/office sit in 'general'.
--   * sort_order        — explicit display order (GM first, then golf, then
--                         dining, then office), mirroring the org sheet layout.
--
-- RLS mirrors facility_status: every authenticated member reads; only
-- staff/admin write. Unlike facility_status these rows CAN be added/removed as
-- staff turn over, so insert/delete are granted (to staff/admin) too.
-- Idempotent: safe to run more than once. The seed only fires when the table is
-- empty, so re-running never clobbers later staff edits.
-- ============================================================================

create table if not exists public.staff_directory (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  title       text not null,
  email       text,
  phone       text,
  department  public.department_type,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists staff_directory_sort_idx on public.staff_directory (sort_order);

drop trigger if exists update_staff_directory_updated_at on public.staff_directory;
create trigger update_staff_directory_updated_at
  before update on public.staff_directory
  for each row execute function public.update_updated_at_column();

-- ---- Seed the current administrative staff (only when the table is empty) ----
insert into public.staff_directory (full_name, title, email, department, sort_order)
select v.full_name, v.title, v.email, v.department::public.department_type, v.sort_order
from (values
  ('Scott Buntin, PGA', 'General Manager & PGA Golf Professional', 'Scott@starkvillecc.org',    'general', 10),
  ('Zach Tate, PGA',    'Director of Golf',                        'Zach@starkvillecc.org',     'golf',    20),
  ('Sam Dupeire',       'Assistant Golf Professional',             'Sam@starkvillecc.org',      'golf',    30),
  ('Justin Lanford',    'Golf Course Superintendent',              'Jlanford33@gmail.com',      'golf',    40),
  ('Haley Sellers',     'Head Chef & Kitchen Manager',             'Haley@starkvillecc.org',    'dining',  50),
  ('Bahaa Awad',        'Front of House Manager',                  'Bahaa@starkvillecc.org',    'dining',  60),
  ('Victoria Luke',     'Office Assistant & Membership Director',  'Victoria@starkvillecc.org', 'general', 70)
) as v(full_name, title, email, department, sort_order)
where not exists (select 1 from public.staff_directory);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.staff_directory enable row level security;

grant select, insert, update, delete on public.staff_directory to authenticated;

-- ---- all authenticated members read ----
drop policy if exists "staff_directory_select_authenticated" on public.staff_directory;
create policy "staff_directory_select_authenticated"
  on public.staff_directory for select to authenticated using (true);

-- ---- staff/admin manage ----
drop policy if exists "staff_directory_insert_staff_admin" on public.staff_directory;
create policy "staff_directory_insert_staff_admin"
  on public.staff_directory for insert to authenticated
  with check ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "staff_directory_update_staff_admin" on public.staff_directory;
create policy "staff_directory_update_staff_admin"
  on public.staff_directory for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "staff_directory_delete_staff_admin" on public.staff_directory;
create policy "staff_directory_delete_staff_admin"
  on public.staff_directory for delete to authenticated
  using ( private.current_user_role() in ('staff', 'admin') );
