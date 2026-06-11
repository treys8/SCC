-- ============================================================================
-- SCC — Contact message rate limit
-- Basic anti-spam: cap each member at 5 contact-form messages per rolling hour.
-- Enforced at the DB (BEFORE INSERT trigger) so it holds even against direct
-- REST inserts, not just the /contact server action. Mirrors the reservations
-- capacity trigger (enforce_reservation_slot in 20260607010000).
--
-- Builds on 20260615000000_member_contact_messages.sql. Idempotent.
-- ============================================================================

create or replace function public.enforce_contact_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  -- Count this member's messages in the trailing hour. BEFORE INSERT, so the
  -- new row isn't counted yet → `>= 5` caps the window at 5.
  select count(*)
    into recent_count
  from public.contact_messages
  where member_id = new.member_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 5 then
    raise exception
      'You''ve sent several messages in the last hour. Please wait a little while before sending another.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_contact_rate_limit() from public, anon, authenticated;

drop trigger if exists enforce_contact_rate_limit_trg on public.contact_messages;
create trigger enforce_contact_rate_limit_trg
  before insert on public.contact_messages
  for each row execute function public.enforce_contact_rate_limit();
