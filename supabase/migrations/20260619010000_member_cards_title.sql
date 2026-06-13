-- ============================================================================
-- member_cards: expose the staff title so the feed can attribute posts.
--
-- Official "club voice" posts previously showed no author; members lose the
-- "Director of Golf is talking" trust signal. The feed resolves post authors
-- through this definer view (see src/lib/feed.ts), so we add the title name
-- here (LEFT JOIN — null for members and titleless staff) rather than widening
-- the restrictive profiles policy. Title names aren't sensitive.
--
-- Recreate preserves the security model from 20260611000000: a definer view
-- (security_invoker = off) locked to authenticated-SELECT only. Dropping the
-- view drops its grants, so they're re-applied below.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

drop view if exists public.member_cards;
create view public.member_cards
  with (security_invoker = off) as
  select p.id, p.full_name, p.avatar_url, t.name as title
  from public.profiles p
  left join public.staff_titles t on t.id = p.title_id;

-- A new view inherits Supabase's default ALL-grant to anon + authenticated.
-- Lock it back to authenticated-SELECT only (matches 20260611000000).
revoke all on public.member_cards from anon;
revoke all on public.member_cards from authenticated;
grant select on public.member_cards to authenticated;
