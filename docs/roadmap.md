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

## In review (2026-07-16 — PRs #40–#46, none merged yet)
A batch closing the highest-leverage gaps. Each was verified against the live DB; the
migrations are already applied, so these are code-only merges.
- **Posts notify members** (#40) — an opt-in push/notification when a post goes live,
  targeted by department. Also adds the `/posts/[id]` detail page it links to.
- **Reservation day-of reminders** (#41) — a daily cron. ⚠️ Uses the **last** Hobby cron slot.
- **Dining closures & special days** (#42) — a date-keyed override table + a weekly
  closed-days rule. Rewrites the reservation capacity trigger. Supersedes the
  unbuilt `feat/dining-service-days` spec.
- **Reservation waitlist** (#43, stacked on #42) — full seatings offer to wait; everyone
  is notified when one frees and the first to book wins.
- **Event RSVP** (#44) — "I'm coming" with a staff-only headcount, for non-GolfGenius events.
- **Course update** (#45) — the superintendent shares a golf-log entry to the feed + a
  Today card.
- **Post reach** (#46) — "seen by N members", counted on scroll-into-view.

## Still open (TODOs)
- ⚠️ **VAPID env vars** — set keys in prod so Phase 7 push actually sends. This now gates
  more than facility alerts: post notifications (#40), reservation reminders (#41), and
  waitlist alerts (#43) all fall back to in-app-only without it.
- **Email alerts** for reservations + contact messages (in-app + push exist; email is TODO).
- **Household visibility** (follow-up from the accounts model). *(Roster import shipped in #34.)*
- **Waitlist purge** — one line to add to the reservation-reminders cron once #41 + #43 land
  (see #43's description).
- ~~**Member-facing Dining/Pool pages**~~ — shipped in #34 (DB-backed via `page_sections`).

---

## Sequencing notes
- **Phases 1–7 are independent of Capacitor** — pure web work, all done.
- ~~Build Phase 4 (Today page) after Phases 2–3~~ — done; it composes the event cards and
  facility-status widget.
- **Phase 7 (push)** reuses Phase 1 (notifications) + Phase 6 (prefs) — built, pending VAPID env.
- **Phase 8 is last and isolated** to its own branch. Wrap only when the v1 web features
  are complete and stable as a PWA. *(Web v1 is feature-complete modulo the open TODOs above.)*
