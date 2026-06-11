-- ============================================================================
-- SCC — Member contact messages
-- A simple member→club contact form backed by a staff inbox. Members submit a
-- subject + message from /contact; staff read and resolve them under
-- /manage/messages. Staff are notified in-app (and via Web Push) on each new
-- message, reusing the existing notifications pipeline.
--
-- Builds on 20260607000000_init.sql (profiles, private.current_user_role).
-- Idempotent where practical. Apply via the Supabase SQL Editor or
-- `supabase db push`.
-- ============================================================================

create table if not exists public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.profiles(id) on delete cascade,
  subject      text not null,
  message      text not null,
  is_resolved  boolean not null default false,
  resolved_by  uuid references public.profiles(id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Staff inbox order: open messages first, newest first within each group.
create index if not exists contact_messages_inbox_idx
  on public.contact_messages (is_resolved, created_at desc);
-- A member's own thread of sent messages.
create index if not exists contact_messages_member_idx
  on public.contact_messages (member_id, created_at desc);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.contact_messages enable row level security;

grant select, insert on public.contact_messages to authenticated;
-- Resolving is the only write members must NOT do; the staff policy below gates
-- it, and the column grant keeps the writable surface minimal.
grant update (is_resolved, resolved_by, resolved_at)
  on public.contact_messages to authenticated;

-- ---- members insert & read their OWN messages ----
drop policy if exists "contact_insert_own" on public.contact_messages;
create policy "contact_insert_own"
  on public.contact_messages for insert to authenticated
  with check ( member_id = (select auth.uid()) );

drop policy if exists "contact_select_own" on public.contact_messages;
create policy "contact_select_own"
  on public.contact_messages for select to authenticated
  using ( member_id = (select auth.uid()) );

-- ---- staff/admin read every message and resolve them ----
drop policy if exists "contact_select_staff" on public.contact_messages;
create policy "contact_select_staff"
  on public.contact_messages for select to authenticated
  using ( private.current_user_role() in ('staff', 'admin') );

drop policy if exists "contact_update_staff" on public.contact_messages;
create policy "contact_update_staff"
  on public.contact_messages for update to authenticated
  using      ( private.current_user_role() in ('staff', 'admin') )
  with check ( private.current_user_role() in ('staff', 'admin') );
