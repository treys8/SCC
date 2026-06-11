-- ============================================================================
-- SCC — add Tennis as a third facility condition (alongside golf & pool).
--
-- The facility_status table was constrained to golf/pool; the staff console and
-- Today page are otherwise fully generic over the FACILITIES list, so adding
-- tennis is just: widen the CHECK, seed the row, and (optionally) seed a couple
-- of detail rows. Realtime already publishes the whole table, so the new row
-- streams to members automatically.
-- Idempotent: safe to run more than once.
-- ============================================================================

alter table public.facility_status
  drop constraint if exists facility_status_facility_check;
alter table public.facility_status
  add constraint facility_status_facility_check
  check (facility in ('golf', 'pool', 'tennis'));

-- Seed the tennis row (default status 'open', empty details for staff to fill).
insert into public.facility_status (facility) values ('tennis')
  on conflict (facility) do nothing;
