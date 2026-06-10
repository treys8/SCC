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

### Phase 4 — "Today at the Club" member home  ← START HERE
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

### Phase 5 — More intuitive feed
- Add `post_type` (announcement / menu / event / …) for differentiated rendering.
- Menu card (image already supported) + optional **Reserve** CTA.
- Typed rendering in `post-card`; collapse long posts (read-more).

### Phase 6 — Member department preferences
- `member_department_preferences` table + profile UI to opt into categories.
- Foundation for per-department push targeting.

### Phase 7 — Push backend (web-first)
- Service worker + Web Push (VAPID); store subscriptions in Supabase.
- Send via Supabase edge function / Vercel function.
- **Alerts = facility status change + push**; per-department opt-in + **safety override**
  (lightning/closures force-send regardless of prefs).
- iOS "Add to Home Screen" onboarding prompt.

### Phase 8 — Capacitor wrap (separate branch, after web v1 is stable)
- Add Capacitor; WebView loads the live Vercel deployment (preserves SSR / server actions).
- Native push plugin → APNs (iOS) + FCM (Android); **reuse the Phase 7 backend, swap transport.**
- Validate Supabase session/cookies in the WebView, safe areas, deep links.
- Store assets + submit to App Store + Play Store.

---

## Sequencing notes
- **Phases 1–5 are independent of Capacitor** — pure web work, build now.
- **Build Phase 4 (Today page) after Phases 2–3** — it composes event cards and the
  facility-status widget; building it first means a page of placeholders.
- **Phase 7 (push)** reuses Phase 1 (notifications) + Phase 6 (prefs).
- **Phase 8 is last and isolated** to its own branch. Wrap only when the v1 web features
  are complete and stable as a PWA.
