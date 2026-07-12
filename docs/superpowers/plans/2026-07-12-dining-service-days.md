# Dining Service Days Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework dining reservations so the member form only offers days the club actually serves, staff control which days are open (window + required-vs-recommended), Fri/Sat and Monday-closed are automatic, and one resolver drives the member form, staff editor, and Today page.

**Architecture:** A new `dining_service_days` table holds staff overrides keyed by date; absence of a row falls back to a code rule (Fri/Sat = dinner+required, Monday = closed, else walk-in). A pure `resolveServiceDay()` in `src/lib/reservations.ts` is the single source of truth. The member form renders closed/walk-in days greyed and generates seating slots from each open day's own window. The DB trigger keeps enforcing slot alignment + capacity; its hard window bound is widened to a permissive outer range so lunch times pass. The per-post `reservation_required_date` flag (0 rows) is removed.

**Tech Stack:** Next.js App Router (custom fork — read `node_modules/next/dist/docs/` before non-trivial Next.js work), TypeScript, Supabase Postgres + RLS, hand-written `database.types.ts`, Vitest for pure-logic tests, Tailwind. Migrations applied to the live project (`fluhpbandhruuqlojlfz`) via the Supabase MCP.

## Global Constraints

- Hand-written types: edit `src/lib/database.types.ts` by hand (mirror the existing `dining_brunch` block shape). Do NOT run `supabase gen types`.
- Times are stored/compared as strings; helpers must accept both `"HH:MM"` and `"HH:MM:SS"` (existing `toMinutes` splits on `:`).
- Club-local weekday math uses `new Date(y, m-1, d).getDay()` on the ISO parts (0=Sun … 6=Sat) — never `new Date(iso)` (UTC drift).
- Staff-only writes go through `requireRole("staff", "admin")`; enable RLS on every new table.
- Dinner default window = the `reservation_settings` singleton (currently `17:00`–`21:00`, 30-min slots). Lunch preset = `11:00`–`14:00`.
- Only pure-logic units (`src/lib/reservations.ts`) get Vitest tests — this codebase does not unit-test React components. UI tasks are verified with `npx tsc --noEmit`, `npm run build`, and manual description.
- Run the full check before any "done" claim: `npx tsc --noEmit && npx eslint . && npm run build && npm test` (Node 20.x).

---

### Task 1: Migration — `dining_service_days` table, widen trigger window, drop post flag

**Files:**
- Create: `supabase/migrations/20260712000000_dining_service_days.sql`

**Interfaces:**
- Produces (DB): table `public.dining_service_days` with columns
  `service_date date PK`, `is_open boolean not null default true`,
  `service_start time`, `service_end time`, `required boolean not null default true`,
  `label text`, `note text`, `updated_by uuid`, `updated_at timestamptz not null default now()`.
- Produces (DB): redefined `public.enforce_reservation_slot()` trigger fn with a widened literal window (`10:00`–`22:00`) instead of the settings window; alignment + capacity unchanged.
- Produces (DB): `posts.reservation_required_date` column dropped.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260712000000_dining_service_days.sql`:

```sql
-- Staff-controlled dining service calendar. A row overrides the code default
-- for that date (open a Sunday lunch / holiday, or force-close a Friday).
-- Absence of a row => resolveServiceDay() falls back to Fri/Sat=dinner,
-- Monday=closed, else walk-in (see src/lib/reservations.ts).
create table public.dining_service_days (
  service_date   date primary key,
  is_open        boolean not null default true,
  service_start  time,
  service_end    time,
  required       boolean not null default true,
  label          text,
  note           text,
  updated_by     uuid references public.profiles (id) on delete set null,
  updated_at     timestamptz not null default now()
);

alter table public.dining_service_days enable row level security;

-- Any signed-in member reads the calendar to render the reservation form.
create policy "service_days_select_authenticated"
  on public.dining_service_days for select
  to authenticated
  using (true);

-- Only staff/admin manage it. Mirrors the existing staff-write pattern:
-- role lives in profiles, checked via a helper the other policies use.
create policy "service_days_write_staff"
  on public.dining_service_days for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Widen the trigger's hard service-window bound so per-day lunch windows
-- (e.g. 11:00-14:00) pass. The precise per-day window is enforced in the
-- server action + UI (the only insert path); the trigger stays the authority
-- on slot alignment + capacity.
create or replace function public.enforce_reservation_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s            public.reservation_settings;
  res_count    integer;
  cover_count  integer;
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  select * into s from public.reservation_settings where id = 1;

  if extract(second from new.reservation_time) <> 0
     or (extract(minute from new.reservation_time)::int % s.slot_minutes) <> 0 then
    raise exception 'Reservation time must align to a %-minute slot.', s.slot_minutes
      using errcode = 'check_violation';
  end if;

  -- Permissive outer bound; per-day window enforced in the app layer.
  if new.reservation_time < time '10:00'
     or new.reservation_time >= time '22:00' then
    raise exception 'Reservations are available between 10:00 AM and 10:00 PM.'
      using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.reservation_date::text || ' ' || new.reservation_time::text, 0)
  );

  select count(*), coalesce(sum(party_size), 0)
    into res_count, cover_count
  from public.reservations
  where reservation_date = new.reservation_date
    and reservation_time = new.reservation_time
    and status in ('pending', 'confirmed')
    and id <> new.id;

  if res_count + 1 > s.max_reservations_per_slot then
    raise exception 'This time is fully booked. Please choose another slot.'
      using errcode = 'check_violation';
  end if;

  if cover_count + new.party_size > s.max_covers_per_slot then
    raise exception 'Not enough seats remain at this time for a party of %.', new.party_size
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Superseded by dining_service_days (0 rows ever used this column).
alter table public.posts drop column if exists reservation_required_date;
```

> **Note:** confirm `public.is_staff()` exists (used by other policies). Run
> `select proname from pg_proc where proname = 'is_staff';` via MCP first. If it
> does NOT exist, replace both policy predicates with an inline check:
> `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin'))`.

- [ ] **Step 2: Verify `is_staff()` exists and adjust the policy if needed**

Via Supabase MCP `execute_sql` on project `fluhpbandhruuqlojlfz`:
```sql
select proname from pg_proc where proname = 'is_staff';
```
Expected: one row `is_staff`. If empty, edit the migration's two policy predicates to the inline `exists(...)` form above before applying.

- [ ] **Step 3: Apply the migration to the live DB**

Use Supabase MCP `apply_migration` with name `dining_service_days` and the file's SQL (project convention records migration history).

- [ ] **Step 4: Verify the schema landed**

Via MCP `execute_sql`:
```sql
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='dining_service_days' order by ordinal_position;
select count(*) as still_has_flag from information_schema.columns
where table_schema='public' and table_name='posts' and column_name='reservation_required_date';
```
Expected: 9 columns listed; `still_has_flag = 0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260712000000_dining_service_days.sql
git commit -m "feat(db): dining_service_days table, widen reservation window, drop post flag"
```

---

### Task 2: Types — add `dining_service_days`, remove `reservation_required_date`

**Files:**
- Modify: `src/lib/database.types.ts`

**Interfaces:**
- Produces: `Database["public"]["Tables"]["dining_service_days"]` (Row/Insert/Update) and export alias `DiningServiceDayRow`.
- Produces: `posts` Row/Insert/Update no longer contain `reservation_required_date`.

- [ ] **Step 1: Add the table type**

In `src/lib/database.types.ts`, add a `dining_service_days` block inside
`Database["public"]["Tables"]` (place it alphabetically near `dining_brunch`),
mirroring the `dining_brunch` shape:

```ts
      dining_service_days: {
        Row: {
          service_date: string;
          is_open: boolean;
          service_start: string | null;
          service_end: string | null;
          required: boolean;
          label: string | null;
          note: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          service_date: string;
          is_open?: boolean;
          service_start?: string | null;
          service_end?: string | null;
          required?: boolean;
          label?: string | null;
          note?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          service_date?: string;
          is_open?: boolean;
          service_start?: string | null;
          service_end?: string | null;
          required?: boolean;
          label?: string | null;
          note?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dining_service_days_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
```

- [ ] **Step 2: Add the export alias**

Near the other aliases at the bottom (by `DiningBrunch`):
```ts
export type DiningServiceDayRow =
  Database["public"]["Tables"]["dining_service_days"]["Row"];
```

- [ ] **Step 3: Remove the post flag from all three `posts` shapes**

In the `posts` table block, delete the `reservation_required_date: string | null;`
line from `Row`, and `reservation_required_date?: string | null;` from `Insert`
and `Update`. (Search the file for `reservation_required_date` — there should be
exactly 3 hits, all under `posts`.)

- [ ] **Step 4: Typecheck (expected to fail with the known consumers)**

Run: `npx tsc --noEmit`
Expected: errors ONLY in files that still reference `reservation_required_date`
or `fetchReservationRequiredDates` (`reservations.ts`, `page.tsx`,
`post-card.tsx`, `post-composer.tsx`, `posts/actions.ts`, `posts/[id]/edit/page.tsx`).
These are fixed in later tasks. No errors about `dining_service_days`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(types): add dining_service_days, drop posts.reservation_required_date"
```

---

### Task 3: Resolver + window/slot helpers in `reservations.ts` (TDD)

**Files:**
- Modify: `src/lib/reservations.ts`
- Create: `src/lib/reservations.test.ts`

**Interfaces:**
- Consumes: `BookingSettings` (existing), `SlotOption` (existing), `MAX_BOOKING_DAYS` (existing), `clubTodayISO`/`clubDatePlusDaysISO` (from `@/lib/format`), `DiningServiceDayRow` (Task 2).
- Produces:
  - `type DiningServiceDay = DiningServiceDayRow`
  - `type ServiceDayState = { kind: "reservations"; start: string; end: string; required: boolean; serviceLabel: string; note: string | null } | { kind: "walkin" } | { kind: "closed" }`
  - `type MemberReservationDay = { iso: string; weekday: string; day: number; label: string; state: ServiceDayState; slots: SlotOption[] }`
  - `resolveServiceDay(iso: string, dinner: { start: string; end: string }, row?: DiningServiceDay): ServiceDayState`
  - `generateSlotsForWindow(start: string, end: string, slotMinutes: number): SlotOption[]`
  - `describeWindow(start: string, end: string, slotMinutes: number): string`
  - `buildMemberReservationDays(count: number, settings: BookingSettings, rows: DiningServiceDay[]): MemberReservationDay[]`
  - `fetchServiceDays(supabase, fromISO, toISO): Promise<DiningServiceDay[]>`
  - `fetchServiceDay(supabase, iso): Promise<DiningServiceDay | null>`
  - `validateReservationRequest(settings: BookingSettings, row: DiningServiceDay | null, date: string, time: string): string | null`
- Removes: `fetchReservationRequiredDates`, `validateBookingSlot`, `serviceWindowNote`. (Keeps `generateSlots(settings)`, `buildUpcomingDays`, `isStandingReservationDay`, `fetchReservationSettings`, `fetchTodaysReservation`, `DayOption`.)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reservations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  describeWindow,
  generateSlotsForWindow,
  resolveServiceDay,
  validateReservationRequest,
  type BookingSettings,
  type DiningServiceDay,
} from "./reservations";
import { clubDatePlusDaysISO, clubTodayISO } from "./format";

const DINNER = { start: "17:00:00", end: "21:00:00" };
const SETTINGS: BookingSettings = {
  slot_minutes: 30,
  service_start: "17:00:00",
  service_end: "21:00:00",
  max_reservations_per_slot: 6,
  max_covers_per_slot: 40,
};

// Known weekdays (2026): 2026-07-17 = Fri, 2026-07-18 = Sat,
// 2026-07-13 = Mon, 2026-07-14 = Tue, 2026-07-19 = Sun.
describe("resolveServiceDay", () => {
  it("auto-opens Friday as required dinner", () => {
    const s = resolveServiceDay("2026-07-17", DINNER);
    expect(s).toEqual({
      kind: "reservations",
      start: "17:00:00",
      end: "21:00:00",
      required: true,
      serviceLabel: "Dinner",
      note: null,
    });
  });

  it("auto-opens Saturday as required dinner", () => {
    expect(resolveServiceDay("2026-07-18", DINNER).kind).toBe("reservations");
  });

  it("closes Monday by default", () => {
    expect(resolveServiceDay("2026-07-13", DINNER)).toEqual({ kind: "closed" });
  });

  it("treats Tue-Thu and Sun as walk-in by default", () => {
    expect(resolveServiceDay("2026-07-14", DINNER)).toEqual({ kind: "walkin" });
    expect(resolveServiceDay("2026-07-19", DINNER)).toEqual({ kind: "walkin" });
  });

  it("lets a staff row open a Sunday lunch (recommended, custom window)", () => {
    const row: DiningServiceDay = {
      service_date: "2026-07-19",
      is_open: true,
      service_start: "11:00:00",
      service_end: "14:00:00",
      required: false,
      label: "Sunday Lunch",
      note: "Locally-sourced menu",
      updated_by: null,
      updated_at: "",
    };
    expect(resolveServiceDay("2026-07-19", DINNER, row)).toEqual({
      kind: "reservations",
      start: "11:00:00",
      end: "14:00:00",
      required: false,
      serviceLabel: "Sunday Lunch",
      note: "Locally-sourced menu",
    });
  });

  it("lets a staff row force-close a Friday", () => {
    const row: DiningServiceDay = {
      service_date: "2026-07-17",
      is_open: false,
      service_start: null,
      service_end: null,
      required: true,
      label: null,
      note: null,
      updated_by: null,
      updated_at: "",
    };
    expect(resolveServiceDay("2026-07-17", DINNER, row)).toEqual({ kind: "closed" });
  });

  it("opens a holiday Monday when a staff row says so, falling back to the dinner window", () => {
    const row: DiningServiceDay = {
      service_date: "2026-05-25",
      is_open: true,
      service_start: null,
      service_end: null,
      required: true,
      label: "Memorial Day",
      note: null,
      updated_by: null,
      updated_at: "",
    };
    expect(resolveServiceDay("2026-05-25", DINNER, row)).toEqual({
      kind: "reservations",
      start: "17:00:00",
      end: "21:00:00",
      required: true,
      serviceLabel: "Memorial Day",
      note: null,
    });
  });
});

describe("generateSlotsForWindow", () => {
  it("steps a lunch window by slot minutes, exclusive of end", () => {
    expect(generateSlotsForWindow("11:00:00", "14:00:00", 30).map((s) => s.value)).toEqual([
      "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    ]);
  });
});

describe("describeWindow", () => {
  it("reads as a seatings sentence", () => {
    expect(describeWindow("17:00:00", "21:00:00", 30)).toBe(
      "Seatings 5:00 PM–9:00 PM, every 30 min.",
    );
  });
});

describe("validateReservationRequest", () => {
  const fri = "2026-07-17"; // Friday, but keep tests date-relative below

  it("rejects a closed day", () => {
    const row: DiningServiceDay = {
      service_date: clubTodayISO(), is_open: false, service_start: null,
      service_end: null, required: true, label: null, note: null,
      updated_by: null, updated_at: "",
    };
    expect(validateReservationRequest(SETTINGS, row, clubTodayISO(), "17:00")).toBe(
      "This day isn't open for reservations.",
    );
  });

  it("rejects a walk-in day (no row, Tuesday)", () => {
    // Pick the next Tuesday within the horizon relative to today is fiddly;
    // assert on a fixed Tue in range via a staff-open contrast instead:
    expect(
      validateReservationRequest(SETTINGS, null, "2026-07-14", "18:00"),
    ).toBe("This day isn't open for reservations.");
  });

  it("rejects a time outside the day's window", () => {
    const row: DiningServiceDay = {
      service_date: clubDatePlusDaysISO(1), is_open: true, service_start: "11:00:00",
      service_end: "14:00:00", required: false, label: "Lunch", note: null,
      updated_by: null, updated_at: "",
    };
    expect(
      validateReservationRequest(SETTINGS, row, clubDatePlusDaysISO(1), "18:00"),
    ).toBe("Choose an available seating time.");
  });

  it("accepts an in-window slot on an open future day", () => {
    const row: DiningServiceDay = {
      service_date: clubDatePlusDaysISO(1), is_open: true, service_start: "11:00:00",
      service_end: "14:00:00", required: false, label: "Lunch", note: null,
      updated_by: null, updated_at: "",
    };
    expect(
      validateReservationRequest(SETTINGS, row, clubDatePlusDaysISO(1), "12:00"),
    ).toBeNull();
  });

  it("rejects a past date", () => {
    const row: DiningServiceDay = {
      service_date: "2000-01-01", is_open: true, service_start: "17:00:00",
      service_end: "21:00:00", required: true, label: null, note: null,
      updated_by: null, updated_at: "",
    };
    expect(validateReservationRequest(SETTINGS, row, "2000-01-01", "18:00")).toBe(
      "Choose a date that hasn't already passed.",
    );
  });
});
```

> Note: `2026-07-14` is a Tuesday and (barring a real DB row) resolves to walk-in
> — but `validateReservationRequest` takes the row explicitly, so passing `null`
> exercises the default-rule branch deterministically regardless of "today".

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- reservations`
Expected: FAIL — `resolveServiceDay` / `generateSlotsForWindow` / `describeWindow` / `validateReservationRequest` not exported.

- [ ] **Step 3: Implement the helpers**

In `src/lib/reservations.ts`:

(a) Add the import for the row alias at the top with the other type imports:
```ts
import type { Database, DiningServiceDayRow, Reservation } from "@/lib/database.types";
```

(b) Add types + resolver. Place after the existing `DayOption` type:
```ts
export type DiningServiceDay = DiningServiceDayRow;

/** What a single date means for dining reservations — the one source of truth. */
export type ServiceDayState =
  | {
      kind: "reservations";
      start: string;
      end: string;
      required: boolean;
      serviceLabel: string;
      note: string | null;
    }
  | { kind: "walkin" }
  | { kind: "closed" };

/** Club-local weekday (0=Sun … 6=Sat) from an ISO date's parts (no TZ drift). */
function clubWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Resolve a date to its dining state. A staff override row wins; otherwise the
 * standing rule: Fri/Sat = required dinner, Monday = closed, everything else =
 * walk-in. `dinner` is the default window (from reservation_settings) used for
 * Fri/Sat and for open rows that leave their window blank.
 */
export function resolveServiceDay(
  iso: string,
  dinner: { start: string; end: string },
  row?: DiningServiceDay,
): ServiceDayState {
  if (row) {
    if (!row.is_open) return { kind: "closed" };
    return {
      kind: "reservations",
      start: row.service_start ?? dinner.start,
      end: row.service_end ?? dinner.end,
      required: row.required,
      serviceLabel: row.label ?? "Reservations",
      note: row.note,
    };
  }
  const dow = clubWeekday(iso);
  if (dow === 5 || dow === 6) {
    return {
      kind: "reservations",
      start: dinner.start,
      end: dinner.end,
      required: true,
      serviceLabel: "Dinner",
      note: null,
    };
  }
  if (dow === 1) return { kind: "closed" };
  return { kind: "walkin" };
}
```

(c) Refactor slot generation. Replace the existing `generateSlots` with a
window-based core it delegates to, and add `describeWindow`:
```ts
/** Bookable times in [start, end) stepped by slotMinutes. */
export function generateSlotsForWindow(
  start: string,
  end: string,
  slotMinutes: number,
): SlotOption[] {
  const from = toMinutes(start);
  const to = toMinutes(end);
  const step = slotMinutes > 0 ? slotMinutes : 30;
  const slots: SlotOption[] = [];
  for (let t = from; t < to; t += step) {
    const value = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    slots.push({ value, label: formatTime(value) });
  }
  return slots;
}

/** Bookable times for the global default window (used by the staff view). */
export function generateSlots(settings: BookingSettings): SlotOption[] {
  return generateSlotsForWindow(
    settings.service_start,
    settings.service_end,
    settings.slot_minutes,
  );
}

/** e.g. "Seatings 5:00 PM–9:00 PM, every 30 min." for a specific window. */
export function describeWindow(
  start: string,
  end: string,
  slotMinutes: number,
): string {
  return `Seatings ${formatTime(start)}–${formatTime(end)}, every ${slotMinutes} min.`;
}
```
Then DELETE the old `generateSlots` body (now replaced above) and DELETE the old
`serviceWindowNote` function.

(d) Add the member day builder. Place after `buildUpcomingDays`:
```ts
export type MemberReservationDay = {
  iso: string;
  weekday: string;
  day: number;
  label: string;
  state: ServiceDayState;
  slots: SlotOption[];
};

/**
 * The next `count` club-local days, each resolved to its dining state, with
 * seating slots precomputed for the open ones. Non-service days carry an empty
 * slot list and render greyed on the form.
 */
export function buildMemberReservationDays(
  count: number,
  settings: BookingSettings,
  rows: DiningServiceDay[],
): MemberReservationDay[] {
  const dinner = { start: settings.service_start, end: settings.service_end };
  const byDate = new Map(rows.map((r) => [r.service_date, r]));
  const [y, m, d] = clubTodayISO().split("-").map(Number);
  const days: MemberReservationDay[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(y, m - 1, d + i);
    const iso = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const state = resolveServiceDay(iso, dinner, byDate.get(iso));
    days.push({
      iso,
      weekday: dt.toLocaleDateString("en-US", { weekday: "short" }),
      day: dt.getDate(),
      label: dt.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      state,
      slots:
        state.kind === "reservations"
          ? generateSlotsForWindow(state.start, state.end, settings.slot_minutes)
          : [],
    });
  }
  return days;
}
```

(e) Replace the DB reads. DELETE `fetchReservationRequiredDates` and add:
```ts
/** Staff override rows in [fromISO, toISO]. Members may read (RLS allows). */
export async function fetchServiceDays(
  supabase: DB,
  fromISO: string,
  toISO: string,
): Promise<DiningServiceDay[]> {
  const { data } = await supabase
    .from("dining_service_days")
    .select("*")
    .gte("service_date", fromISO)
    .lte("service_date", toISO);
  return data ?? [];
}

/** The override row for a single date, or null. */
export async function fetchServiceDay(
  supabase: DB,
  iso: string,
): Promise<DiningServiceDay | null> {
  const { data } = await supabase
    .from("dining_service_days")
    .select("*")
    .eq("service_date", iso)
    .maybeSingle();
  return data;
}
```

(f) Replace validation. DELETE `validateBookingSlot` and add:
```ts
/**
 * Server-side boundary for a booking request: the day must resolve to an open
 * reservation day, the date must be present-or-future within the horizon, and
 * the time must be a real slot in that day's window. The DB trigger remains the
 * final authority on capacity/alignment. Returns an error message, or null.
 */
export function validateReservationRequest(
  settings: BookingSettings,
  row: DiningServiceDay | null,
  date: string,
  time: string,
): string | null {
  if (!ISO_DATE.test(date)) return "Choose a valid date.";
  if (date < clubTodayISO()) {
    return "Choose a date that hasn't already passed.";
  }
  if (date > clubDatePlusDaysISO(MAX_BOOKING_DAYS)) {
    return `Reservations can only be made up to ${MAX_BOOKING_DAYS} days out.`;
  }
  const dinner = { start: settings.service_start, end: settings.service_end };
  const state = resolveServiceDay(date, dinner, row ?? undefined);
  if (state.kind !== "reservations") {
    return "This day isn't open for reservations.";
  }
  const slots = generateSlotsForWindow(state.start, state.end, settings.slot_minutes);
  if (!slots.some((s) => s.value === time)) {
    return "Choose an available seating time.";
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- reservations`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reservations.ts src/lib/reservations.test.ts
git commit -m "feat(reservations): service-day resolver, per-window slots, request validation"
```

---

### Task 4: Member reservation form — per-day slots, greyed closed/walk-in days

**Files:**
- Modify: `src/app/(app)/reservations/page.tsx` (the `MemberView` function only)
- Modify: `src/components/new-reservation-form.tsx`

**Interfaces:**
- Consumes: `buildMemberReservationDays`, `fetchServiceDays`, `fetchReservationSettings`, `describeWindow`, `MemberReservationDay` (Task 3).
- Produces: `NewReservationForm` now takes `{ days: MemberReservationDay[]; slotMinutes: number }` (drops `slots` and `windowNote`).

- [ ] **Step 1: Update `MemberView` in `page.tsx`**

Replace the imports from `@/lib/reservations` used by `MemberView`. The page-top
import block becomes:
```ts
import {
  buildMemberReservationDays,
  buildUpcomingDays,
  fetchReservationSettings,
  fetchServiceDays,
  generateSlots,
} from "@/lib/reservations";
```
(`buildUpcomingDays`/`generateSlots` stay for `StaffView`; `describeWindow` is
used inside the form, not the page.)

Replace the `MemberView` data-loading + `days`/`slots` block. The new body from
`const baseDays` through the `<NewReservationForm .../>` element:
```ts
  const supabase = await createClient();
  const settings = await fetchReservationSettings(supabase);

  // Resolve the next 7 club-local days to their dining state up front so we know
  // which dates to pull staff overrides for.
  const horizon = buildUpcomingDays(7); // reuse for its date range only
  const rows = await fetchServiceDays(
    supabase,
    horizon[0].iso,
    horizon[horizon.length - 1].iso,
  );

  const { data } = await supabase
    .from("reservations")
    .select("*")
    .eq("member_id", profile.id)
    .order("reservation_date", { ascending: false })
    .order("reservation_time", { ascending: false });
  const reservations = data ?? [];

  const days = buildMemberReservationDays(7, settings, rows);
```
And the JSX element:
```tsx
      <NewReservationForm days={days} slotMinutes={settings.slot_minutes} />
```
Remove the now-unused `settings`/`requiredDates`/`slots`/`baseDays` code and the
old `Promise.all`. Keep the rest of `MemberView` (the "Your reservations"
section) unchanged.

- [ ] **Step 2: Rewrite `NewReservationForm`**

Replace `src/components/new-reservation-form.tsx` entirely:
```tsx
"use client";

import { useRef, useState } from "react";
import {
  createReservation,
  type ReservationState,
} from "@/app/(app)/reservations/actions";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/cn";
import { describeWindow, type MemberReservationDay } from "@/lib/reservations";

const INITIAL: ReservationState = {};

/** First day the club actually takes reservations, for the default selection. */
function firstOpenIso(days: MemberReservationDay[]): string {
  return days.find((d) => d.state.kind === "reservations")?.iso ?? "";
}

export function NewReservationForm({
  days,
  slotMinutes,
}: {
  days: MemberReservationDay[];
  slotMinutes: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ReservationState>(INITIAL);

  const [date, setDate] = useState(() => firstOpenIso(days));
  const [time, setTime] = useState("");
  const [party, setParty] = useState(2);

  async function submit(formData: FormData) {
    const res = await createReservation(INITIAL, formData);
    setResult(res);
    if (res.success) {
      setDate(firstOpenIso(days));
      setTime("");
      setParty(2);
      formRef.current?.reset();
    }
  }

  const selectedDay = days.find((d) => d.iso === date);
  const open = selectedDay?.state.kind === "reservations" ? selectedDay.state : null;
  const slots = selectedDay?.slots ?? [];
  const ready = Boolean(date && time && open);
  const slotLabel = slots.find((s) => s.value === time)?.label;
  const submitLabel = ready
    ? `Request — ${selectedDay?.label} · ${slotLabel} · Party of ${party}`
    : "Choose a day and time";

  return (
    <form ref={formRef} action={submit} className="card p-6">
      <h2 className="text-h2 text-foreground">Request a reservation</h2>
      <p className="mt-1 text-sm text-muted">
        Staff will confirm your reservation shortly.
      </p>

      <input type="hidden" name="reservation_date" value={date} />
      <input type="hidden" name="reservation_time" value={time} />
      <input type="hidden" name="party_size" value={party} />

      <fieldset className="mt-5">
        <legend className="label">Day</legend>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d) => {
            const isOpen = d.state.kind === "reservations";
            const active = d.iso === date;
            const closedLabel =
              d.state.kind === "closed" ? "Closed" : isOpen ? null : "Walk-in";
            return (
              <button
                key={d.iso}
                type="button"
                disabled={!isOpen}
                onClick={() => {
                  if (!isOpen) return;
                  setDate(d.iso);
                  setTime("");
                }}
                aria-pressed={active}
                className={cn(
                  "flex w-14 shrink-0 flex-col items-center rounded-lg border px-2 py-2 transition-colors",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-foreground hover:border-primary",
                  !isOpen &&
                    "cursor-not-allowed border-border bg-surface-2 text-muted opacity-60 hover:border-border",
                )}
              >
                <span
                  className={cn(
                    "text-2xs font-medium uppercase tracking-wide",
                    active ? "text-white/80" : "text-muted",
                  )}
                >
                  {d.weekday}
                </span>
                <span className="text-lg font-semibold leading-tight">{d.day}</span>
                {isOpen && d.state.required && (
                  <span
                    aria-hidden
                    title="Reservations required"
                    className={cn(
                      "mt-1 h-1.5 w-1.5 rounded-full",
                      active ? "bg-white/90" : "bg-accent",
                    )}
                  />
                )}
                {closedLabel && (
                  <span className="mt-0.5 text-[9px] font-medium uppercase tracking-tight text-muted">
                    {closedLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {open && (
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              open.required ? "text-accent-600" : "text-muted",
            )}
          >
            {open.serviceLabel} ·{" "}
            {open.required
              ? "Reservations required."
              : "Reservations recommended — walk-ins welcome."}
            {open.note ? ` ${open.note}` : ""}
          </p>
        )}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">Seating</legend>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((s) => {
            const active = s.value === time;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setTime(s.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-foreground hover:border-primary",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {open && (
          <p className="field-hint">
            {describeWindow(open.start, open.end, slotMinutes)}
          </p>
        )}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">Party size</legend>
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => setParty((n) => Math.max(1, n - 1))}
            disabled={party <= 1}
            aria-label="Fewer guests"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-xl leading-none text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="w-10 text-center text-lg font-semibold tabular-nums"
          >
            {party}
          </span>
          <button
            type="button"
            onClick={() => setParty((n) => Math.min(50, n + 1))}
            disabled={party >= 50}
            aria-label="More guests"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-xl leading-none text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            +
          </button>
          <span className="text-sm text-muted">
            {party === 1 ? "guest" : "guests"}
          </span>
        </div>
      </fieldset>

      <div className="mt-5">
        <label className="label" htmlFor="special_requests">
          Special requests <span className="text-muted">(optional)</span>
        </label>
        <textarea
          id="special_requests"
          name="special_requests"
          className="textarea"
          maxLength={500}
          placeholder="Window table, high chair, dietary needs…"
        />
      </div>

      <div className="mt-6">
        <SubmitButton className="w-full" pendingText="Submitting…" disabled={!ready}>
          {submitLabel}
        </SubmitButton>
        <div className="mt-2 min-h-5 text-sm">
          {result.success && (
            <span className="text-success">Reservation requested.</span>
          )}
          {result.error && <span className="text-danger">{result.error}</span>}
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `new-reservation-form.tsx` or `reservations/page.tsx`'s
`MemberView`. (The action still references the old validator — fixed in Task 5;
errors there are expected until then.)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/reservations/page.tsx src/components/new-reservation-form.tsx
git commit -m "feat(reservations): member form renders per-day windows + closed/walk-in days"
```

---

### Task 5: `createReservation` action — per-day validation

**Files:**
- Modify: `src/app/(app)/reservations/actions.ts`

**Interfaces:**
- Consumes: `fetchReservationSettings`, `fetchServiceDay`, `validateReservationRequest` (Task 3).

- [ ] **Step 1: Swap the validator**

In `src/app/(app)/reservations/actions.ts`, change the reservations import:
```ts
import {
  fetchReservationSettings,
  fetchServiceDay,
  validateReservationRequest,
} from "@/lib/reservations";
```
Then in `createReservation`, replace the settings+validate block:
```ts
  const supabase = await createClient();
  // The picker only offers open days + in-window slots, but the action is the
  // real boundary: re-resolve the day and validate against its window. A crafted
  // POST can send a closed day or an off-window time; the DB trigger still backs
  // us on capacity/alignment.
  const [settings, row] = await Promise.all([
    fetchReservationSettings(supabase),
    fetchServiceDay(supabase, date),
  ]);
  const slotError = validateReservationRequest(settings, row, date, time);
  if (slotError) return { error: slotError };
```
(Leave the rest of `createReservation` — the insert, revalidate, return —
unchanged.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `reservations/actions.ts`.

- [ ] **Step 3: Manually verify the boundary via SQL** (the form can't run locally — no Supabase creds in `.env.local`)

Via MCP `execute_sql`, confirm the widened trigger accepts a lunch time and the
alignment guard still bites. Use a real member id and a future Sunday you'll
open in Task 6; for now just assert the trigger window is permissive:
```sql
-- Should NOT raise the window error (12:00 is inside 10:00-22:00); will only
-- fail on FK/other constraints, proving the window widened. Rolled back.
begin;
insert into reservations (member_id, reservation_date, reservation_time, party_size)
values ('2bd243ec-ce6e-49ce-a8a1-b8044e985cf5', current_date + 2, '12:00', 2);
rollback;
```
Expected: no `Reservations are available between…` exception (insert succeeds
inside the txn, then rolls back).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/reservations/actions.ts
git commit -m "feat(reservations): validate booking against the day's resolved window"
```

---

### Task 6: Staff "Reservation days" editor in `/manage/dining`

**Files:**
- Create: `src/app/(app)/manage/dining/service-days-actions.ts`
- Create: `src/components/dining/service-days-editor.tsx`
- Modify: `src/app/(app)/manage/dining/page.tsx`

**Interfaces:**
- Consumes: `requireRole`, `createClient`, `revalidatePath`, `buildMemberReservationDays`, `fetchServiceDays`, `fetchReservationSettings`, `MemberReservationDay`.
- Produces: server actions `upsertServiceDay(input: ServiceDayInput)` and `clearServiceDay(date: string)`; `type ServiceDayInput`.

- [ ] **Step 1: Write the server actions**

Create `src/app/(app)/manage/dining/service-days-actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export type ServiceDayInput = {
  service_date: string;
  is_open: boolean;
  service_start: string | null;
  service_end: string | null;
  required: boolean;
  label: string | null;
  note: string | null;
};

function normTime(t: string | null): string | null {
  if (!t) return null;
  return TIME.test(t) ? t : null;
}
function trimOrNull(v: string | null, max: number): string | null {
  const s = (v ?? "").trim().slice(0, max);
  return s || null;
}

function revalidate() {
  revalidatePath("/reservations");
  revalidatePath("/manage/dining");
  revalidatePath("/");
}

/** Create or replace the override row for a date. */
export async function upsertServiceDay(input: ServiceDayInput) {
  const profile = await requireRole("staff", "admin");
  if (!ISO_DATE.test(input.service_date)) {
    throw new Error("Invalid date.");
  }

  const clean = {
    service_date: input.service_date,
    is_open: Boolean(input.is_open),
    service_start: normTime(input.service_start),
    service_end: normTime(input.service_end),
    required: Boolean(input.required),
    label: trimOrNull(input.label, 60),
    note: trimOrNull(input.note, 200),
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dining_service_days")
    .upsert(clean, { onConflict: "service_date" });
  if (error) throw new Error(error.message);

  revalidate();
}

/** Remove the override for a date, reverting it to the automatic rule. */
export async function clearServiceDay(date: string) {
  await requireRole("staff", "admin");
  if (!ISO_DATE.test(date)) throw new Error("Invalid date.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("dining_service_days")
    .delete()
    .eq("service_date", date);
  if (error) throw new Error(error.message);

  revalidate();
}
```

- [ ] **Step 2: Write the editor component**

Create `src/components/dining/service-days-editor.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import {
  clearServiceDay,
  upsertServiceDay,
  type ServiceDayInput,
} from "@/app/(app)/manage/dining/service-days-actions";
import { cn } from "@/lib/cn";
import type { MemberReservationDay } from "@/lib/reservations";

const DINNER = { start: "17:00", end: "21:00" };
const LUNCH = { start: "11:00", end: "14:00" };

type Mode = "auto" | "open" | "closed";

/** Current display state for a day, plus whether it has an override row. */
export type ServiceDayRowView = MemberReservationDay & { hasOverride: boolean };

function stateSummary(d: MemberReservationDay): string {
  switch (d.state.kind) {
    case "reservations":
      return `${d.state.serviceLabel} · ${d.state.required ? "required" : "recommended"} · ${d.state.start.slice(0, 5)}–${d.state.end.slice(0, 5)}`;
    case "walkin":
      return "Walk-in (no reservations)";
    case "closed":
      return "Closed";
  }
}

function DayRow({ day }: { day: ServiceDayRowView }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  const open = day.state.kind === "reservations" ? day.state : null;
  const [mode, setMode] = useState<Mode>(
    day.hasOverride ? (day.state.kind === "closed" ? "closed" : "open") : "auto",
  );
  const [winStart, setWinStart] = useState((open?.start ?? "17:00").slice(0, 5));
  const [winEnd, setWinEnd] = useState((open?.end ?? "21:00").slice(0, 5));
  const [required, setRequired] = useState(open?.required ?? true);
  const [label, setLabel] = useState(open?.serviceLabel === "Dinner" ? "" : open?.serviceLabel ?? "");
  const [note, setNote] = useState(open?.note ?? "");

  function save() {
    start(async () => {
      if (mode === "auto") {
        await clearServiceDay(day.iso);
      } else {
        const input: ServiceDayInput = {
          service_date: day.iso,
          is_open: mode === "open",
          service_start: mode === "open" ? winStart : null,
          service_end: mode === "open" ? winEnd : null,
          required: mode === "open" ? required : false,
          label: mode === "open" ? label || null : null,
          note: mode === "open" ? note || null : null,
        };
        await upsertServiceDay(input);
      }
      setEditing(false);
    });
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{day.label}</p>
          <p className="truncate text-sm text-muted">{stateSummary(day)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide",
              day.hasOverride
                ? "border-accent/40 text-accent-600"
                : "border-border text-muted",
            )}
          >
            {day.hasOverride ? "Custom" : "Auto"}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface-2 p-3">
          <div className="flex flex-wrap gap-2">
            {(["auto", "open", "closed"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium capitalize transition-colors",
                  mode === m
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-muted hover:border-primary",
                )}
              >
                {m === "auto" ? "Auto (default)" : m === "open" ? "Open" : "Closed"}
              </button>
            ))}
          </div>

          {mode === "open" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setWinStart(DINNER.start);
                    setWinEnd(DINNER.end);
                  }}
                >
                  Dinner 5–9
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setWinStart(LUNCH.start);
                    setWinEnd(LUNCH.end);
                  }}
                >
                  Lunch 11–2
                </button>
                <input
                  type="time"
                  value={winStart}
                  onChange={(e) => setWinStart(e.target.value)}
                  className="input w-28"
                  aria-label="Window start"
                />
                <span className="text-muted">–</span>
                <input
                  type="time"
                  value={winEnd}
                  onChange={(e) => setWinEnd(e.target.value)}
                  className="input w-28"
                  aria-label="Window end"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                />
                Reservations required (uncheck for recommended / walk-ins welcome)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
                placeholder="Label (e.g. Sunday Lunch, Mother's Day) — optional"
                className="input w-full"
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="Member-facing note — optional"
                className="input w-full"
              />
            </>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={save}
              disabled={pending}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ServiceDaysEditor({ days }: { days: ServiceDayRowView[] }) {
  return (
    <div className="card divide-y divide-border">
      {days.map((d) => (
        <DayRow key={d.iso} day={d} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the manage page**

In `src/app/(app)/manage/dining/page.tsx`:

(a) Add imports:
```ts
import { ServiceDaysEditor, type ServiceDayRowView } from "@/components/dining/service-days-editor";
import {
  buildMemberReservationDays,
  fetchReservationSettings,
  fetchServiceDays,
} from "@/lib/reservations";
import { clubTodayISO, clubDatePlusDaysISO } from "@/lib/format";
```
(`clubDatePlusDaysISO` and `clubTodayISO` are already exported from format.ts.)

(b) Inside `ManageDiningPage`, after the existing `Promise.all` data loads, add:
```ts
  const settings = await fetchReservationSettings(supabase);
  const serviceRows = await fetchServiceDays(
    supabase,
    clubTodayISO(),
    clubDatePlusDaysISO(21),
  );
  const overrideDates = new Set(serviceRows.map((r) => r.service_date));
  const serviceDays: ServiceDayRowView[] = buildMemberReservationDays(
    21,
    settings,
    serviceRows,
  ).map((d) => ({ ...d, hasOverride: overrideDates.has(d.iso) }));
```

(c) Add a section to the returned JSX (place it after the brunch `<BrunchEditor>`
section and before the dish catalog):
```tsx
      <section className="space-y-3">
        <div>
          <h2 className="text-h2 text-foreground">Reservation days</h2>
          <p className="text-sm text-muted">
            Fri &amp; Sat dinner are open automatically; Mondays are closed. Open a
            Sunday lunch or a holiday, or close a night, for the next three weeks.
          </p>
        </div>
        <ServiceDaysEditor days={serviceDays} />
      </section>
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. If `.input`/`.btn-secondary` utility classes are unknown, check
an existing editor (`brunch-editor.tsx`) for the exact class names in use and
match them.

- [ ] **Step 5: Verify the round-trip via SQL**

After building, exercise the action path indirectly by inserting an override and
confirming the resolver reads it (the UI can't run locally). Via MCP:
```sql
insert into dining_service_days (service_date, is_open, service_start, service_end, required, label)
values (date_trunc('week', current_date)::date + 6, true, '11:00', '14:00', false, 'Sunday Lunch')
on conflict (service_date) do update set is_open=excluded.is_open;
select * from dining_service_days;
delete from dining_service_days where label = 'Sunday Lunch';
```
Expected: the row inserts and reads back, then cleans up.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/manage/dining/service-days-actions.ts src/components/dining/service-days-editor.tsx src/app/\(app\)/manage/dining/page.tsx
git commit -m "feat(manage): reservation-days editor for staff-controlled service calendar"
```

---

### Task 7: Today page — dinner card via `resolveServiceDay`

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `resolveServiceDay`, `fetchServiceDay`, `fetchReservationSettings`.

- [ ] **Step 1: Resolve today's dining state**

In `src/app/(app)/page.tsx`, change the reservations import to include the new
helpers (replace `isStandingReservationDay`):
```ts
import {
  fetchReservationSettings,
  fetchServiceDay,
  fetchTodaysReservation,
  resolveServiceDay,
} from "@/lib/reservations";
```
Add `dining_service_days` + settings reads to the existing parallel loads (add
two entries to the `Promise.all` array and destructure them), then replace the
`isDinnerNight` line:
```ts
  const settings = await fetchReservationSettings(supabase);
  const serviceRow = await fetchServiceDay(supabase, today);
  const todayState = resolveServiceDay(
    today,
    { start: settings.service_start, end: settings.service_end },
    serviceRow ?? undefined,
  );
  const dinnerService = todayState.kind === "reservations" ? todayState : null;
```

- [ ] **Step 2: Render from the resolved state**

Replace the dinner `DiningCard` block. Where it currently reads:
```tsx
      {isDinnerNight && (
        <DiningCard
          ...
          title="Dinner service"
          ...
          reservation="required"
        />
      )}
```
change to:
```tsx
      {dinnerService && (
        <DiningCard
          eyebrow="Tonight"
          title={dinnerService.serviceLabel}
          reservation={dinnerService.required ? "required" : "recommended"}
        />
      )}
```
> Check `src/components/today/dining-card.tsx`'s `reservation` prop type. If it
> only accepts `"required" | "walk_in"`, extend the union with `"recommended"`
> and render it as "Reservations recommended" (mirror the "required" label
> branch). Keep the existing `eyebrow`/`title`/`meta`/`description` props intact.
> Preserve whatever props the current dinner card passes (copy them over).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. Confirm no remaining references to `isStandingReservationDay` in
`page.tsx` (`grep -n isStandingReservationDay src/app/\(app\)/page.tsx` → empty).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/page.tsx src/components/today/dining-card.tsx
git commit -m "feat(today): dinner card driven by the service-day resolver"
```

---

### Task 8: Remove the per-post reservation-required-date UI + plumbing

**Files:**
- Modify: `src/components/post-composer.tsx`
- Modify: `src/components/post-card.tsx`
- Modify: `src/app/(app)/posts/actions.ts`
- Check: `src/app/(app)/posts/[id]/edit/page.tsx`

**Interfaces:**
- Removes: `reservationRequiredDate` from `CreatePostInput`/`UpdatePostInput` and all references to `post.reservation_required_date`.

- [ ] **Step 1: Strip the composer**

In `src/components/post-composer.tsx`:
- Remove `reservation_required_date: string | null;` from the post prop type (line ~44).
- Remove the `reservationRequired` and `reservationRequiredDate` `useState` hooks (lines ~115–120).
- Remove the two `reservationRequiredDate:` payload fields (lines ~307 and ~362 blocks).
- Remove the JSX: the "reservations required" checkbox and its conditional date
  input (the block around lines ~610–632 starting at `checked={reservationRequired}`).
- Keep everything about `reservationCta` (the "Reserve a table" checkbox) — that
  stays.

- [ ] **Step 2: Strip the post card**

In `src/components/post-card.tsx`:
- Remove the `const requiredDate = post.reservation_required_date;` line (~45) and
  the JSX block that renders the "reservations required" callout from it. (Search
  `requiredDate` and remove its declaration + usage.)
- Keep `reservation_cta` / `PostReservationCta`.

- [ ] **Step 3: Strip the actions**

In `src/app/(app)/posts/actions.ts`:
- Remove `reservationRequiredDate: string | null;` from `CreatePostInput` and
  `UpdatePostInput` (~line 58).
- Remove the `reservationRequiredDate:` sanitize/derivation blocks (~84–87, ~152, ~218).
- Remove `reservation_required_date: reservationRequiredDate,` from both the
  insert and update payloads (~175, ~265).

- [ ] **Step 4: Check the edit page passes nothing stale**

Run: `grep -n reservation_required_date src/app/\(app\)/posts/\[id\]/edit/page.tsx`
If it maps `reservation_required_date` into the composer's `post` prop, remove
that line. If empty, nothing to do.

- [ ] **Step 5: Full typecheck**

Run: `npx tsc --noEmit`
Expected: PASS with zero errors (all `reservation_required_date` references gone).
Confirm: `grep -rn reservation_required_date src/` → empty.

- [ ] **Step 6: Commit**

```bash
git add src/components/post-composer.tsx src/components/post-card.tsx src/app/\(app\)/posts/actions.ts src/app/\(app\)/posts/\[id\]/edit/page.tsx
git commit -m "refactor(posts): remove per-post reservation-required flag (superseded by service days)"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `npx tsc --noEmit && npx eslint . && npm run build && npm test`
Expected: typecheck clean, eslint clean, build succeeds, all Vitest tests pass
(including the new `reservations.test.ts`).

- [ ] **Step 2: Confirm no dead references**

Run:
```bash
grep -rn "reservation_required_date\|fetchReservationRequiredDates\|validateBookingSlot\|serviceWindowNote" src/
```
Expected: empty (all removed/renamed).

- [ ] **Step 3: Manual smoke checklist (record results in the PR description)**

Since local dev can't boot Supabase (no creds in `.env.local`), verify against a
deploy preview or note as "verified via build + SQL":
- Member `/reservations`: only Fri/Sat selectable this week; Mon greyed "Closed";
  Tue–Thu/Sun greyed "Walk-in"; selecting Fri shows 5–9 PM slots + "required".
- Staff `/manage/dining` → Reservation days: open a Sunday with the Lunch preset,
  mark recommended, save; reload member form → that Sunday now selectable with
  11–2 slots and "recommended" copy.
- Today page on a Fri shows the "Tonight / Dinner" card.

- [ ] **Step 4: Update memory**

Append a NEWEST entry to
`/Users/Trey/.claude/projects/-Users-Trey-Desktop-SCC/memory/scc-current-work-state.md`
summarizing the shipped feature, the migration name, and that the post flag was
dropped. Cross-link `[[scc-reservations-system]]`.

---

## Self-Review

**Spec coverage:**
- Data model `dining_service_days` + RLS → Task 1. ✓
- Drop `posts.reservation_required_date` → Task 1 (DB), Task 2 (types), Task 8 (app). ✓
- Resolver three-state precedence (override → Fri/Sat → Monday → walk-in) → Task 3 + tests. ✓
- Per-day windows / slots → Task 3 (`generateSlotsForWindow`, `buildMemberReservationDays`), Task 4 (form). ✓
- Required vs recommended toggle → Task 3 (state), Task 4 (badge), Task 6 (editor). ✓
- Member form greyed closed/walk-in days → Task 4. ✓
- Server-side per-day validation + widened DB trigger → Task 1 (trigger), Task 3 (`validateReservationRequest`), Task 5 (action). ✓
- Staff editor in `/manage/dining` with Dinner/Lunch presets, open/close, label/note → Task 6. ✓
- Holiday Mondays opened manually (no holiday code) → covered by the override row path; no auto-holiday logic anywhere. ✓
- Today page consistency → Task 7. ✓
- `dining_brunch` untouched → confirmed (no task modifies it). ✓
- Tests on resolver + slot generation + validation → Task 3. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Two
guard notes (verify `is_staff()` exists; confirm `dining-card` prop union) are
explicit conditional instructions with the fallback spelled out, not deferrals.

**Type consistency:** `ServiceDayState`, `MemberReservationDay`,
`DiningServiceDay`, `ServiceDayInput` names are used identically across Tasks
3/4/5/6/7. `resolveServiceDay(iso, dinner, row?)` signature matches every call
site (form builder, action, Today page). `generateSlotsForWindow(start, end,
slotMinutes)` and `describeWindow(start, end, slotMinutes)` are consistent.
`fetchServiceDay`/`fetchServiceDays` return types match their consumers.
