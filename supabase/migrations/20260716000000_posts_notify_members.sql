-- Post push notifications: opt-in per post.
--
-- Publishing a post has never reached members who weren't already looking at the
-- app — push fired only for facility alerts and reservation status changes. This
-- adds the authoring intent ("also send a push") and the send bookkeeping:
--   notify_members — the composer toggle, off by default so today's behaviour is
--                    unchanged and a push is always a deliberate choice. It rides
--                    along on drafts/scheduled posts so the intent survives until
--                    the publish cron sends it.
--   notified_at    — set the moment a send is claimed. Both publish paths (the
--                    createPost/updatePost actions and the cron) claim with a
--                    conditional UPDATE ... WHERE notified_at IS NULL, so a post
--                    can never be pushed twice — not by an edit, not by a cron
--                    retry, not by the two racing.
--
-- Departmental targeting is resolved at send time from member_department_
-- preferences (opt-OUT storage), so nothing about the audience is stored here.
--
-- Idempotent: safe to run more than once.

alter table public.posts
  add column if not exists notify_members boolean not null default false;

alter table public.posts
  add column if not exists notified_at timestamptz;

comment on column public.posts.notify_members is
  'Author intent: send members a notification + push when this post goes live. Off by default; the audience is resolved at send time from department opt-outs.';
comment on column public.posts.notified_at is
  'When the notification fan-out was claimed for this post. Non-null means it has been sent — the claim (UPDATE ... WHERE notified_at IS NULL) is the double-send guard shared by the publish actions and the cron.';
