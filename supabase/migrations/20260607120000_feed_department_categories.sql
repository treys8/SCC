-- ============================================================================
-- SCC feed — expand department categories.
--
-- Adds four club departments to the existing `department_type` enum so the
-- feed can be filtered beyond golf/dining/tennis/general.
--
-- Kept in its own migration on purpose: Postgres does not allow a newly added
-- enum value to be *used* in the same transaction that adds it, so category
-- additions live apart from any migration that inserts rows using them.
--
-- Idempotent: `ADD VALUE IF NOT EXISTS` is a no-op when the value exists.
-- ============================================================================

alter type public.department_type add value if not exists 'pool';
alter type public.department_type add value if not exists 'social';
alter type public.department_type add value if not exists 'pro_shop';
alter type public.department_type add value if not exists 'membership';
