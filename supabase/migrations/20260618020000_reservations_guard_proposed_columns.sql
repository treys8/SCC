-- ============================================================================
-- SCC — Harden the member-update guard for the counter-offer columns.
--
-- reservations_update_own_or_staff lets a member UPDATE their own row; the only
-- backstop is guard_reservation_member_update, which pins members to
-- status -> 'cancelled' with every OTHER column unchanged. The counter-offer
-- columns (proposed_date/proposed_time) were added AFTER that guard, so they
-- weren't in its column list — a member could set them on their own row, then
-- call acceptProposedTime() to self-confirm a reservation at a slot of their
-- choosing, bypassing FOH approval. Add the two columns to the guard so members
-- can never write a counter-offer (only staff/admin and trusted server code can).
--
-- Idempotent: CREATE OR REPLACE updates the function in place; the existing
-- trigger keeps pointing at it.
-- ============================================================================

create or replace function public.guard_reservation_member_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;                                      -- service role / trusted server
  end if;
  if private.current_user_role() in ('staff', 'admin') then
    return new;
  end if;

  -- The owning member: the only legal change is status -> 'cancelled'.
  if new.status            is distinct from 'cancelled'
     or new.member_id        is distinct from old.member_id
     or new.reservation_date is distinct from old.reservation_date
     or new.reservation_time is distinct from old.reservation_time
     or new.party_size       is distinct from old.party_size
     or new.special_requests is distinct from old.special_requests
     or new.table_id         is distinct from old.table_id
     or new.staff_note       is distinct from old.staff_note
     or new.proposed_date    is distinct from old.proposed_date
     or new.proposed_time    is distinct from old.proposed_time then
    raise exception 'Members may only cancel their own reservation.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_reservation_member_update() from public, anon, authenticated;
