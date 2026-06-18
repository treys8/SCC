-- Per-post "reservations required" exception flag.
--
-- The club's standing rule — Fri & Sat dinner always require a reservation — is
-- pure day-of-week logic in the app (no storage, so it can't be forgotten). This
-- column captures the *exceptions* a staff member announces in a post: a Sunday
-- lunch, a holiday, a special dinner. When set, the post shows a "Reservations
-- required" badge and that club date is flagged on the member /reservations day
-- picker. NULL = this post is not a requirement announcement.

alter table public.posts
  add column if not exists reservation_required_date date;

comment on column public.posts.reservation_required_date is
  'When set, this post declares dining reservations are required for that club date (an exception to the standing Fri/Sat rule). Surfaces a badge on the post and on the /reservations day picker. NULL = not a requirement.';

-- The member reservations page filters posts by this date over a 7-day window;
-- a partial index keeps that lookup cheap and skips the (vast) NULL majority.
create index if not exists posts_reservation_required_date_idx
  on public.posts (reservation_required_date)
  where reservation_required_date is not null;
