-- ============================================================================
-- Members: optional display ("preferred") name
-- ----------------------------------------------------------------------------
-- `full_name` is the formal name of record, but `handle_new_user` seeds it with
-- the member's login email when no name is supplied — which is why the Today
-- greeting could read "Good morning, treys8@outlook.com." `display_name` lets a
-- member say what they'd like to be called; the greeting prefers it, falls back
-- to `full_name`, and finally to a generic "Member" when neither is a real name
-- (an email-shaped value doesn't count). Nullable: existing rows simply have no
-- preferred name yet. Covered by the existing `profiles_update_own` policy, so a
-- member can set their own. Idempotent.
-- ============================================================================
alter table public.profiles
  add column if not exists display_name text;
