# Golf season schedule + Weekly Golf Preview template

**Date:** 2026-06-28
**Status:** Approved design

## Motivation

A screenshot of the incumbent app (Clubster) showed the Director of Golf's "SCC
Weekly Golf Preview & More" — a single monolithic newsletter cramming ten things
into one text blob: intro prose, weekly programming (skins game, tee-time
window), an event highlight (4th of July Scramble), match-play results, a dated
summer schedule (~10 events), golf course news, golf shop news with a sale list,
a 6-day weather forecast, a hosting heads-up, and a sign-off.

Mapping that post onto SCC showed most of it already has a better home than a
wall of text (events with Register buttons, the live conditions card, `pro_shop`
posts, the staff-title byline). The remaining gaps worth closing — chosen with
the user — are:

1. The **dated summer schedule** has no structured, member-facing home. Events
   exist, but there's no "rest of the season" view.
2. There's no **starter** to help the Director of Golf adopt the feed instead of
   reaching for a giant newsletter out of habit.

Deliberately **not** built: the 7-day forecast (deferred), match-play
standings/leaderboards (GolfGenius territory — a roadmap non-goal), and
multi-day event ranges / real capacity tracking (existing limitations; not
needed here, since GolfGenius owns registration).

## Scope

Three small, additive pieces. No breaking changes; everything layers onto
existing patterns (events, the facility detail page, `POST_TEMPLATES`).

### 1. Schema — one nullable column

Migration adds `schedule_note text` (nullable) to `calendar_events`, and the
matching field is added to `database.types.ts` in the `calendar_events` Row,
Insert, and Update types.

`schedule_note` is a free-text, staff-typed status string surfaced in the
member schedule list. It covers all three incumbent "extras" without building
anything we can't populate:

- "Field full · 162/162"
- "Registration opens Jul 21"
- "Course closed"

It is intentionally *not* structured capacity tracking — GolfGenius owns real
registration counts, so any number here is a manual staff string.

### 2. Staff write path

**`src/components/event-form.tsx`**
- Add a controlled `scheduleNote` state, seeded from `event?.schedule_note ?? ""`
  (controlled, like the other fields, so a validation error doesn't wipe it).
- Render an input paired next to *Fee* in a two-column grid row.
  - Label: `Schedule note (optional)`
  - `name="schedule_note"`
  - Hint (`field-hint`): "Shown on the Golf page's season schedule — e.g. 'Field
    full · 162/162' or 'Registration opens Jul 21'."

**`src/app/(app)/calendar/actions.ts`**
- Add to the shared `fields` object (built once, used by both `createEvent` and
  `updateEvent`):
  ```ts
  schedule_note: String(formData.get("schedule_note") ?? "").trim() || null,
  ```

### 3. Member read path — "Upcoming on the course"

**`src/app/(app)/facility/[type]/page.tsx`** (server component)
- When `facility === "golf"`, fetch upcoming golf events:
  ```ts
  supabase
    .from("calendar_events")
    .select("id, title, event_date, start_time, schedule_note, registration_url")
    .eq("department", "golf")
    .gte("event_date", clubTodayISO())
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(12)
  ```
  (`clubTodayISO` from `@/lib/format`.) Pass the result to `FacilityDetailView`
  as an `upcoming` prop. For non-golf facilities, pass `[]` (or omit) so the
  section never renders.

**`src/components/facility-detail-view.tsx`**
- Accept a new optional prop `upcoming?: UpcomingGolfEvent[]` where the row shape
  is the narrow select above.
- Below the existing conditions/details block, render an **"Upcoming on the
  course"** section **only when `upcoming` has entries**. If empty, render
  nothing (no empty-state card — the section simply doesn't appear).
- Each entry renders as a row in a `card`:
  - A date chip (e.g. "Jul 4") derived from `event_date`.
  - The event `title` (medium weight).
  - `schedule_note`, when present, as a muted subline.
  - A **Register** button (link to `registration_url`, `target="_blank"
    rel="noopener noreferrer"`) when `registration_url` is set — same deep-link
    behavior as event cards elsewhere.
- This list is server-rendered and static for the page load; it does **not** need
  realtime. The existing live conditions (`useLiveFacilityStatus`) are untouched.
- Date formatting uses a club-time-safe helper from `@/lib/format` (reuse an
  existing date formatter; do not hand-roll `new Date()` parsing of the ISO
  `event_date`).

### 4. Weekly Golf Preview template

**`src/lib/constants.ts`** — add one entry to `POST_TEMPLATES`:
- `key: "golf_preview"`
- `label: "Weekly Golf Preview"`
- `department: "golf"`
- `asClub: true`
- `body`: a prose skeleton with light section markers — greeting → *This week on
  the course* → *Upcoming events* → *From the golf shop* → *Course notes* →
  sign-off. It is **prose-only** and points members to the Golf page for the full
  schedule rather than recreating the dated list as typed text (decompose, don't
  replicate the blob).

Draft body (final wording can be tuned during implementation):
```
Good morning SCC members,

[A line or two on what kind of week it is for golf.]

This week on the course
–

Upcoming events
See the full season schedule on the Golf page. [Link the headline tournament
below if you have one.]

From the golf shop
–

Course notes
–

See you out there,
[Your name]
```

## Components & boundaries

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `calendar_events.schedule_note` | Persist a staff status string per event | migration, types |
| `EventForm` field | Capture the note when creating/editing an event | `schedule_note` column |
| `createEvent`/`updateEvent` | Persist the note via the shared `fields` object | column |
| `FacilityDetailPage` (golf) | Fetch upcoming golf events server-side | events table, `clubTodayISO` |
| `FacilityDetailView` "Upcoming" section | Render the schedule list, omit when empty | `upcoming` prop, format helper |
| `POST_TEMPLATES` golf_preview | One-tap composer starter for the Director of Golf | existing template system |

## Testing / verification

- Migration applies cleanly to the live DB; `schedule_note` is nullable and
  existing rows are unaffected.
- Create an event with department=golf, a future date, a `schedule_note`, and a
  GolfGenius `registration_url`; confirm it appears under "Upcoming on the
  course" on `/facility/golf` with the note and a working Register button.
- Edit the event's note; confirm the change persists and re-renders.
- Confirm a golf facility page with **no** upcoming golf events shows **no**
  "Upcoming on the course" section.
- Confirm non-golf facility pages (pool, tennis, driving range) are unchanged.
- Confirm "Weekly Golf Preview" appears in the composer's "Start from a
  template" picker, pre-fills golf + club voice + the skeleton, and posts.
- `npm run build` / lint pass.

## Out of scope (explicit)

- 7-day weather forecast (deferred by the user).
- Match-play standings / leaderboards (GolfGenius owns this; roadmap non-goal).
- Multi-day event date ranges and real capacity/registration tracking.
- A standalone season-schedule page or new nav entry (placement is the Golf
  facility page only).
