-- ============================================================================
-- SCC — Club contact info (singleton).
--
-- One row of club-level "how to reach / find us" details, shown on the Contact
-- surface and reusable in footers, the directory, and ICS locations. Kept as a
-- singleton (one club) the same way dining_buffet is: a boolean primary key
-- that can only be true caps the table at exactly one row.
--
--   * street_address / city / state / postal_code — the physical address
--     (1800 South Montgomery St, Starkville, MS 39759). Split into columns so a
--     map link or single-line render can be composed without re-parsing.
--   * mailing_address — free text, because the PO box sits in a different ZIP
--     (PO Box 226, Starkville, MS 39760) and isn't a street address.
--   * phone — primary club line. email / website are reserved for later (the
--     contact card doesn't list them yet), so they seed null.
--
-- RLS mirrors dining_buffet: every authenticated member reads; only staff/admin
-- update. The single row is seeded here, so update is the only write granted.
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.club_info (
  -- Singleton: a boolean PK that can only be true caps the table at one row.
  id              boolean primary key default true check (id),
  street_address  text,
  city            text,
  state           text,
  postal_code     text,
  mailing_address text,
  phone           text,
  email           text,
  website         text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null
);

-- Seed the one row with the current contact details.
insert into public.club_info
  (id, street_address, city, state, postal_code, mailing_address, phone)
values
  (true, '1800 South Montgomery St', 'Starkville', 'MS', '39759',
   'PO Box 226, Starkville, MS 39760', '662-323-1733')
  on conflict (id) do nothing;

drop trigger if exists update_club_info_updated_at on public.club_info;
create trigger update_club_info_updated_at
  before update on public.club_info
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.club_info enable row level security;

grant select, update on public.club_info to authenticated;

-- ---- all authenticated members read ----
drop policy if exists "club_info_select_authenticated" on public.club_info;
create policy "club_info_select_authenticated"
  on public.club_info for select to authenticated using (true);

-- ---- staff/admin update (the single row is seeded, so update is the only write) ----
drop policy if exists "club_info_update_staff_admin" on public.club_info;
create policy "club_info_update_staff_admin"
  on public.club_info for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );
