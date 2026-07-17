# SCC Member Portal — Roadmap

## Vision
Replace **Clubster** (a one-way text feed) with a richer, more functional member app
for Starkville Country Club. The wedge: **turn announcements into actions** (book,
register, get alerted) and surface the **live updates members rely on** (golf, pool).

## Delivery model
- Build as a **Next.js 16 PWA** (stack: Next 16 + Supabase, deployed on Vercel).
- Ship **web/PWA first** to get value into members' hands.
- Wrap the *same* web app in **Capacitor** near the end → App Store + Play Store with
  native push (APNs/FCM). One codebase, both platforms, reliable iOS push (no
  "Add to Home Screen" hurdle).
- The Capacitor wrap is a **late, self-contained step in its own git branch/worktree.**
  Do **not** block feature work on it — there's nothing to wrap until the features exist.

## Explicit non-goals (staff-workflow constraints — do not rebuild these)
- **No in-app tee sheet.** Tee times stay pro-shop phone calls.
- **No tournament registration rebuild.** Tournaments stay on GolfGenius; we deep-link / hand off only.
- **Menus in v1 = a nice card/image** (chef posts a flyer), *not* structured menu items.

## Foundation (already built — strong)
- Hardened Supabase schema, comprehensive RLS, 4 migrations applied.
- **Feed (~85%):** infinite scroll, realtime "new posts" pill, 8-department filter,
  multi-attachment posts, pinning.
- **Dining reservations (~75%):** member booking form + staff confirm/decline table +
  capacity-enforcing DB triggers.
- **Calendar/events (~70%):** staff CRUD, month grid, department filter, `.ics` route.
- **PWA scaffolding:** manifest, apple-icon, viewport/notch handling. *(No service worker yet.)*

---

## Phased plan

### Phase 1 — Finish dinner reservations + wire notifications  ✅ DONE (2026-06-09)
The `notifications` table exists but is **never written to**. Wiring it is the connective
tissue for reservations *and* later push.
- ✅ Write a notification on reservation status change (confirmed/declined).
- ✅ Surface the declined reason (`staff_note`) to the member.
- ✅ In-app notification center + bell (unread count, mark read).
- *(Optional, still open)* live slot availability ("3 left at 6:30").

### Phase 2 — Event cards + GolfGenius handoff  ✅ DONE (2026-06-10)
- Add `registration_url`, `fee`, optional cover image to `calendar_events`.
- Build **one shared `EventCard` component**, reused in three places: the Today page
  (Phase 4), the feed (via Phase 5 `post_type`), and the calendar detail page.
- Card = cover image, title, date/time/location, department badge, **Register**
  (deep-link out) + **Add to calendar** (`.ics` exists).
- Extend `event-form` for staff to enter registration URL + fee.

### Phase 3 — Facility status widget (golf / pool)  ✅ DONE (2026-06-10)
- New `facility_status` table (facility, status, message, updated_at/by).
- Fast staff control with **preset buttons**: Frost / Rain / Lightning hold / Open / Closed / All clear.
  One tap + lifecycle (All clear reverts).
- Pinned, realtime-updated status widget.

### Phase 4 — "Today at the Club" member home  ✅ DONE (2026-06-11)
- Build the member home (today members are redirected straight to `/posts`).
- Glanceable **Today page**, not a second feed: fixed sections, no infinite scroll,
  empty sections collapse. Feed stays its own tab — Today answers "what's happening
  right now / what do I need to do", the feed answers "what's been announced".
- Sections, in priority order:
  1. **Facility status** (Phase 3 widget) — pinned, realtime.
  2. **Your next reservation** — "Tonight, 6:30 PM, party of 4, Confirmed."
  3. **Today on the calendar** — today's events as `EventCard`s (Phase 2).
  4. **Weather** — current temp + conditions + wind for the club's lat/long.
     Server-side fetch (Open-Meteo, free/no key), cached ~15–30 min. A glance,
     not a forecast page; pairs with facility status ("87° and sunny / Pool: Open").
  5. **Latest 2–3 posts** teaser with "View all" → `/posts`.

### Phase 5 — More intuitive feed  ⏭️ SKIPPED
Superseded by the Feed redesign (see "Beyond the original plan" below): the feed went
**category-led** with staff-pin-any instead of a typed `post_type` system. Revisit only
if structured menu/event post rendering is still wanted.
- ~~Add `post_type` (announcement / menu / event / …) for differentiated rendering.~~
- ~~Menu card (image already supported) + optional **Reserve** CTA.~~
- ~~Typed rendering in `post-card`; collapse long posts (read-more).~~

### Phase 6 — Member department preferences  ✅ DONE (2026-06-11)
- ✅ `member_department_preferences` table + profile UI to opt into categories.
  *(Stored as **opt-out**: absence of a row = subscribed to all.)*
- ✅ Foundation for per-department push targeting.

### Phase 7 — Push backend (web-first)  ✅ DONE (2026-06-11) — ⚠️ VAPID env still pending
- ✅ Service worker + Web Push (VAPID); store subscriptions in Supabase.
- ✅ Send via Supabase edge function / Vercel function.
- ✅ **Alerts = facility status change + push**; per-department opt-in + **safety override**
  (lightning/closures force-send regardless of prefs).
- ✅ iOS "Add to Home Screen" onboarding prompt.
- ⚠️ **Blocker before push works in prod:** VAPID keys not yet set as env vars.

### Phase 8 — Capacitor wrap (separate branch, after web v1 is stable)  ⬜ NOT STARTED
- Add Capacitor; WebView loads the live Vercel deployment (preserves SSR / server actions).
- Native push plugin → APNs (iOS) + FCM (Android); **reuse the Phase 7 backend, swap transport.**
- Validate Supabase session/cookies in the WebView, safe areas, deep links.
- Store assets + submit to App Store + Play Store.

---

## Beyond the original plan (built, not in the phased plan above)
These shipped to `main` on top of the phased work:
- **Staff operations console (`/manage`)** — conditions, posts, documents, dining, directory,
  club-info, and member editors in one place.
- **Member accounts & membership model** — staff-assigned account numbers (one account ↔ many
  logins), staff titles lookup w/ singleton GM, and a **staff invite flow**.
- **Member contact form** → `contact_messages` table → staff inbox at `/manage/messages`
  (notifies staff via in-app notifications + push).
- **Today / Feed / Reservations redesign** — category-led feed (staff-pin-any), "Tonight"
  featured card on Today, concierge reservations form.
- **Driving range** added as a 4th facility, plus a member `/facility/[type]` detail page
  with a live compact conditions card.
- **Tennis** added as a 3rd facility; **document library** (menus as PDFs).
- **Security hardening** pass on RLS / schema.
- **FOH reservations workflow** (2026-06-13) — a per-night **nightly chart** (date-scoped
  confirmed list + running cover count, printable) on the staff reservations page, and a
  **counter-offer flow**: declining can propose an alternate slot the member one-tap accepts
  (capacity re-checked on accept — the slot trigger now fires on UPDATE too). Available to all
  staff; surfaced as a console tile.
- **Golf Course Superintendent daily log** (2026-06-13) — `/manage/golf-log`: dated **done** items
  and **issues** (open issues carry forward until resolved), optional photo, from phone or web.
  Private to course leadership — the **GM + Director of Golf** read and comment; new entries notify
  them, their comments notify the superintendent. Gated by title via new `requireTitle` /
  `private.current_user_title()`; RLS on `golf_log_entries` / `golf_log_comments`.

- **Notifications, dining depth & engagement batch** (2026-07-16, PRs #40–#46, #48) — seven
  features closing the highest-leverage gaps:
  - **Posts notify members** — an opt-in in-app + push notification when a post goes live,
    targeted by department (opt-outs respected), sent exactly once via a claim on
    `posts.notified_at`. Fires from the composer and from the scheduled-publish cron. Added
    the `/posts/[id]` detail page the notification links to (it didn't exist).
  - **Reservation day-of reminders** — a daily cron for confirmed bookings.
    ⚠️ Uses the **second and last** Vercel Hobby cron slot.
  - **Dining closures & special days** — `dining_service_overrides` (date-keyed) +
    `club_settings.weekly_closed_weekdays`. Precedence: date row > weekly rule > derived
    service. A special day *replaces* normal service. Rewrote `enforce_reservation_slot()`
    to honour both. (Supersedes the unbuilt `feat/dining-service-days` spec.)
  - **Reservation waitlist** — full seatings offer to wait; when one frees, everyone waiting
    is told at once and the first to book wins (the capacity trigger arbitrates).
  - **Event RSVP** — "I'm coming" with a **staff-only** headcount (enforced by RLS), for
    events without a GolfGenius `registration_url`.
  - **Course update** — the superintendent shares a golf-log entry to the feed + a Today
    "From the course" card. The log itself stays private.
  - **Post reach** — "seen by N members", counted on scroll-into-view, staff-only.

## Still open (TODOs)
- ⚠️ **VAPID env vars** — set keys in prod so Phase 7 push actually sends. **This now gates far
  more than facility alerts:** post notifications, reservation reminders, and waitlist alerts
  all fall back to in-app-only without it. Highest-value env change available.
- **Dining `walkin` state** — the club serves lunch Tue–Fri but takes dinner reservations only
  Fri/Sat, and the booking form still offers dinner Tue–Thu. The override model has two states
  (closed / normal); this needs a third (`reservations` / `walkin` / `closed`) so Tue–Thu can be
  open-but-unbookable without hiding the lunch buffet. See the `feat/dining-service-days` spec.
- **Waitlist purge** — one line in `/api/cron/reservation-reminders`
  (`delete from reservation_waitlist where reservation_date < today`). Harmless meanwhile:
  every read is date-filtered.
- **View tracking on `/posts/[id]`** — members arriving from a push notification aren't counted
  toward reach, so the most engaged readers are invisible.
- **Email alerts** for reservations + contact messages (in-app + push exist; email is TODO).
- **Household visibility** (follow-up from the accounts model).

---

## Sequencing notes
- **Phases 1–7 are independent of Capacitor** — pure web work, all done.
- ~~Build Phase 4 (Today page) after Phases 2–3~~ — done; it composes the event cards and
  facility-status widget.
- **Phase 7 (push)** reuses Phase 1 (notifications) + Phase 6 (prefs) — built, pending VAPID env.
- **Phase 8 is last and isolated** to its own branch. Wrap only when the v1 web features
  are complete and stable as a PWA. *(Web v1 is feature-complete modulo the open TODOs above.)*
