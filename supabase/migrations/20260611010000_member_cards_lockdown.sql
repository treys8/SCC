-- ============================================================================
-- Lock down the member_cards view privileges.
--
-- member_cards (added in 20260611000000) inherited Supabase's default table
-- privileges (ALL granted to anon + authenticated). Because it is a SECURITY
-- DEFINER, auto-updatable view over public.profiles, that is dangerous:
--   • anon could SELECT it → read every member's name/avatar unauthenticated.
--   • authenticated could INSERT/UPDATE/DELETE through it → writes execute as
--     the view owner and BYPASS profiles RLS, letting any member rewrite or
--     delete other members' profile rows.
--
-- The view is meant to be authenticated-read-only. Revoke everything, then
-- grant back only SELECT to authenticated.
-- Idempotent: safe to run more than once.
-- ============================================================================
revoke all on public.member_cards from anon;
revoke all on public.member_cards from authenticated;
grant select on public.member_cards to authenticated;
