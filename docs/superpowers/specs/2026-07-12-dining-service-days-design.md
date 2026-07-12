# Dining Service Days — staff-controlled reservation calendar

**Date:** 2026-07-12
**Status:** Approved design, ready for implementation plan

## Problem

The member reservation form (`/reservations`) currently offers dinner seatings (5:00–9:00 PM)
**every day** for the next 7 days, regardless of whether the club actually serves. A member can
request a Monday or Tuesday dinner table the kitchen never staffs.

The club's real dining rhythm:

- **Monday** — closed (unless a holiday like Memorial Day / Labor Day falls on it).
- **Tuesday–Friday** — lunch (Blue Plate buffet); no reservations.
- **Friday & Saturday** — dinner; reservations required.
- **Sunday** — brunch (11–2), walk-in; occasionally a Sunday lunch service.
- **Special days** — Mother's Day, Father's Day, holidays: staff-decided exceptions.

Today "reservations required" is only a *badge*, driven by a hardcoded Fri/Sat rule plus a per-post
flag (`posts.reservation_required_date`) — an awkward coupling of a dining-service concept to feed
posts. Zero posts use that flag.

## Goal

Give staff a single, low-maintenance control over which upcoming days accept reservations, on what
window, and whether reservations are required — while keeping the common Fri/Sat case zero-upkeep.
Make the member form, the staff editor, and the Today page all agree via one resolver.

## Non-goals

- A general club-hours / facility-open system beyond dining reservations. (The lunch buffet already
  has its own `buffet_week`; brunch has `dining_brunch`. Those are untouched.)
- An automatic US-holiday calendar. Holiday Mondays are opened manually by staff.
- Changing capacity/slot-alignment enforcement (the DB trigger stays authoritative on those).

## Data model

New table `dining_service_days` — staff overrides, keyed by date. Absence of a row = fall back to
the code default rule.

| column | type | meaning |
|---|---|---|
| `service_date` | `date` PK | the calendar date |
| `is_open` | `boolean not null default true` | `true` = reservations this day; `false` = force-closed (e.g. close a Friday for a private event) |
| `service_start` | `time` (nullable) | booking window start; falls back to the dinner default |
| `service_end` | `time` (nullable) | booking window end |
| `required` | `boolean not null default true` | `true` = reservations required; `false` = recommended / walk-ins welcome |
| `label` | `text` (nullable) | optional heading, e.g. "Sunday Lunch", "Mother's Day" |
| `note` | `text` (nullable) | optional member-facing line |
| `updated_by` | `uuid` (nullable) | audit |
| `updated_at` | `timestamptz not null default now()` | audit |

**RLS:** enable RLS. `select` to `authenticated` (members read the calendar to render the form).
`insert`/`update`/`delete` to staff/admin only (mirror the existing `posts_update_staff` /
management pattern; check `is_staff`/role).

### Migration for the removed post flag

- Drop `posts.reservation_required_date` (0 rows use it).
- Remove `fetchReservationRequiredDates` and the post-card callout that renders it.
- Remove the composer's "reservations required on [date]" checkbox and its action plumbing
  (`CreatePostInput`/`UpdatePostInput` fields, the `posts/actions.ts` handling).

## Resolution logic — the single source of truth

`resolveServiceDay(iso: string, row?: DiningServiceDay): ServiceDayState`

Returns one of three states plus display data:

```
type ServiceDayState =
  | { kind: "reservations"; start: string; end: string; required: boolean; label: string; note?: string }
  | { kind: "walkin" }    // club open, no reservations needed (Tue–Thu, Sun)
  | { kind: "closed" }    // club shut (Monday)
```

Precedence:

1. **Staff row exists** → if `is_open`, `{ kind: "reservations", ... }` using the row's window
   (falling back to the dinner default when null), `required`, `label`; if `!is_open`,
   `{ kind: "closed" }`.
2. Else **Fri or Sat** → `{ kind: "reservations", dinner default window, required: true, label: "Dinner" }`.
3. Else **Monday** → `{ kind: "closed" }`.
4. Else (Tue–Thu, Sun) → `{ kind: "walkin" }`.

Weekday is computed on the club-local ISO date exactly as `isStandingReservationDay` does today
(`new Date(y, m-1, d).getDay()`), so no timezone drift. The dinner default window comes from the
existing `reservation_settings` singleton (currently 17:00–21:00, 30-min slots).

Memorial Day / Labor Day: staff add a row with `is_open=true` for that Monday. No holiday code.

## Member reservation form (`/reservations`)

- The day strip resolves each of the next N days (keep ~7; revisit horizon during implementation).
- **`reservations`** days are selectable. **`walkin`** and **`closed`** days are greyed and
  unselectable, labeled "Walk-in" and "Closed" respectively.
- Selecting a reservation day generates slots from **that day's** window (per-day), not the global
  one — so a Sunday lunch shows 11:00–2:00 and a Friday shows 5:00–9:00.
- Badge reads **"Reservations required"** or **"Reservations recommended"** per `required`.
- The window note (`serviceWindowNote`) becomes per-day.
- Any `label`/`note` renders near the selected day.

### Server-side enforcement (`createReservation`)

- Re-resolve the submitted date. Reject if `closed` or `walkin` ("This day isn't open for
  reservations").
- Validate the submitted time against **that day's** resolved window + slot alignment (extend
  `validateBookingSlot` to take a per-day window instead of only the global settings).
- The DB trigger remains the final authority on slot alignment + capacity. Its hard service-window
  bound is **widened to a permissive outer range** (e.g. 10:00–22:00) so lunch times pass; the
  precise per-day window is enforced in the action + UI, which is the only insert path (RLS lets a
  member insert only their own row, and the form is the sole entry point).

## Staff management — new "Reservation days" section in `/manage/dining`

`ReservationDaysEditor` component, added alongside the existing buffet/brunch/dish editors so all
dining controls stay together.

- Lists the next ~3 weeks of dates, each showing its resolved state, badged **"Auto"** (untouched
  Fri/Sat or default) vs **"Custom"** (has an override row).
- Per date, staff can: open/close, set window (with quick **Dinner** [17:00–21:00] and **Lunch**
  [11:00–14:00] presets, plus manual entry), toggle **required** vs **recommended**, and set an
  optional `label`/`note`.
- Server actions: `upsertServiceDay(date, fields)` and `clearServiceDay(date)` (delete the row →
  revert to the auto default). Guarded by `requireRole(staff/admin)`; `revalidatePath` on
  `/reservations`, `/manage/dining`, and `/` (Today).

## Today page consistency

The Today dinner card switches from the ad-hoc Fri/Sat check to `resolveServiceDay(clubTodayISO())`,
so a staff-opened Sunday lunch or holiday Monday surfaces on Today — not just Fri/Sat. `dining_brunch`
(Sunday brunch card) is unchanged and remains walk-in.

## Testing

- Unit-test `resolveServiceDay`: auto Fri/Sat (reservations+required), override-open Sunday lunch
  (per-day window + recommended), override-close Friday (closed), Monday default (closed), Tue–Thu
  default (walkin), Memorial-Day-Monday override (reservations).
- Unit-test per-day slot generation (`generateSlots` against a lunch window vs dinner window).
- Unit-test `validateBookingSlot` rejecting a closed/walk-in day and an out-of-window time.

## Files touched (anticipated)

- **Migration:** `dining_service_days` table + RLS; drop `posts.reservation_required_date`.
- `src/lib/reservations.ts` — add `resolveServiceDay`, `DiningServiceDay` type, `ServiceDayState`;
  per-day `generateSlots`/`validateBookingSlot`/`serviceWindowNote`; replace
  `buildUpcomingDays` day-resolution; remove `fetchReservationRequiredDates`.
- `src/lib/database.types.ts` — new table + `reservation_required_date` removal.
- `src/app/(app)/reservations/page.tsx` + form component — greyed/labeled closed/walk-in days,
  per-day slots + badge.
- `src/app/(app)/reservations/actions.ts` — re-resolve day, per-day validation.
- `src/app/(app)/manage/dining/page.tsx` + new `ReservationDaysEditor` + its actions.
- `src/app/(app)/page.tsx` — Today card via `resolveServiceDay`.
- `src/components/post-composer.tsx`, `post-card.tsx`, `src/app/(app)/posts/actions.ts` — remove the
  reservation-required-date checkbox/callout/plumbing.
- Tests in `src/lib/reservations.test.ts` (or the existing test file).
