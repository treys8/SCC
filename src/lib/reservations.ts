/**
 * Reservation booking helpers. The DB enforces the service window, slot
 * alignment, and capacity (see 20260607010000_reservations_system.sql); these
 * read the same `reservation_settings` so the booking form only ever offers
 * times the trigger will accept.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { dayDiningStatus } from "@/lib/dining";
import type {
  Database,
  DiningServiceOverride,
  Reservation,
} from "@/lib/database.types";
import { clubDatePlusDaysISO, clubTodayISO, formatTime } from "@/lib/format";

type DB = SupabaseClient<Database>;

/** How far out a reservation may be booked. The member form offers 7 days; this
 * gives headroom while rejecting past/absurd-future dates from crafted requests. */
export const MAX_BOOKING_DAYS = 14;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type SlotOption = { value: string; label: string };

/** One selectable day pill: the ISO date plus its display parts. */
export type DayOption = {
  iso: string;
  weekday: string;
  day: number;
  label: string;
  /** True when a reservation is required that day — the standing Fri/Sat rule,
   * or a staff-flagged exception the page merges in. Drives the form's badge. */
  required?: boolean;
  /** The club isn't serving that day (a closure or the weekly rule) — the pill
   * is shown, but not bookable. */
  closed?: boolean;
  /** Name of the special service replacing normal dining that day, if any. */
  specialName?: string | null;
};

export type BookingSettings = {
  slot_minutes: number;
  service_start: string;
  service_end: string;
  max_reservations_per_slot: number;
  max_covers_per_slot: number;
};

const DEFAULT_SETTINGS: BookingSettings = {
  slot_minutes: 30,
  service_start: "17:00:00",
  service_end: "21:00:00",
  max_reservations_per_slot: 6,
  max_covers_per_slot: 40,
};

/** The singleton settings row (id = 1), or sensible defaults if unset. */
export async function fetchReservationSettings(
  supabase: DB,
): Promise<BookingSettings> {
  const { data } = await supabase
    .from("reservation_settings")
    .select(
      "slot_minutes, service_start, service_end, max_reservations_per_slot, max_covers_per_slot",
    )
    .eq("id", 1)
    .single();
  return data ?? DEFAULT_SETTINGS;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The club's standing rule: dinner reservations are required Friday & Saturday.
 * Pure day-of-week logic on the club-local calendar date — the ISO string is a
 * wall-clock date, so `getDay()` on the local Date is the club's weekday. No
 * storage, so it can never be forgotten. Sunday-lunch / special-occasion
 * exceptions are layered on separately (see `fetchReservationRequiredDates`).
 */
export function isStandingReservationDay(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun … 6=Sat
  return dow === 5 || dow === 6;
}

/**
 * The next `count` calendar days starting today, computed in the club's timezone
 * so the pills don't drift to the server's TZ. Wall-clock date math (Date with
 * local components) rolls month/year boundaries correctly. Built server-side and
 * passed to the form so server and client agree on "today".
 */
export function buildUpcomingDays(count: number): DayOption[] {
  const [y, m, d] = clubTodayISO().split("-").map(Number);
  const days: DayOption[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(y, m - 1, d + i);
    const iso = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(
      dt.getDate(),
    )}`;
    days.push({
      iso,
      weekday: dt.toLocaleDateString("en-US", { weekday: "short" }),
      day: dt.getDate(),
      label: dt.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      required: isStandingReservationDay(iso),
    });
  }
  return days;
}

/**
 * Validate a supplied booking date + time against the same window the UI offers:
 * a canonical ISO date that isn't in the past, within MAX_BOOKING_DAYS, on a real
 * slot boundary. Returns an error message, or null if acceptable. The DB trigger
 * remains the final authority on capacity/alignment; this is a server-side guard
 * that gives a clear message and stops hand-crafted POSTs (bypassing the picker)
 * from persisting nonsense like "2026-6-7", "9999-01-01", or an off-slot time.
 */
export function validateBookingSlot(
  settings: BookingSettings,
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
  if (!generateSlots(settings).some((s) => s.value === time)) {
    return "Choose an available seating time.";
  }
  return null;
}

/**
 * Is the club serving at all on this date? Returns a member-facing reason, or
 * null if it's bookable. Pairs with `validateBookingSlot`, which answers "is
 * this a real seating time" — this answers "is there service that day".
 *
 * Mirrors the closure half of enforce_reservation_slot(): the trigger still has
 * the final say, this just turns its raise into a message worth reading.
 */
export function validateBookingDay(
  iso: string,
  weeklyClosed: number[],
  override?: DiningServiceOverride | null,
): string | null {
  if (dayDiningStatus(iso, weeklyClosed, override) !== "closed") return null;
  return override?.name
    ? `The club is closed for dining that day (${override.name}).`
    : "The club is closed for dining that day.";
}

/** Bookable times: [service_start, service_end) stepped by slot_minutes. */
export function generateSlots(settings: BookingSettings): SlotOption[] {
  const start = toMinutes(settings.service_start);
  const end = toMinutes(settings.service_end);
  const step = settings.slot_minutes > 0 ? settings.slot_minutes : 30;
  const slots: SlotOption[] = [];
  for (let t = start; t < end; t += step) {
    const value = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    slots.push({ value, label: formatTime(value) });
  }
  return slots;
}

/**
 * The member's soonest still-active reservation *for today* (pending or
 * confirmed), or null — powers the Today page's "Tonight" card. Today-scoped:
 * the card shows an invitation when there's nothing on tonight, regardless of
 * what's booked later in the week. Declined/cancelled are excluded — they
 * aren't something to show up for. `today` is the club-local date (the caller
 * computes it in the club's timezone, not the server's).
 */
export async function fetchTodaysReservation(
  supabase: DB,
  memberId: string,
  today: string,
): Promise<Reservation | null> {
  const { data } = await supabase
    .from("reservations")
    .select("*")
    .eq("member_id", memberId)
    .eq("reservation_date", today)
    .in("status", ["pending", "confirmed"])
    .order("reservation_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * The set of club dates in [fromISO, toISO] that staff have flagged as
 * "reservations required" via a post — the exceptions to the standing Fri/Sat
 * rule (e.g. a Sunday lunch). Read on the member reservations page and merged
 * onto the day pills. Any member may read posts, so this runs as the member.
 */
export async function fetchReservationRequiredDates(
  supabase: DB,
  fromISO: string,
  toISO: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("posts")
    .select("reservation_required_date")
    .not("reservation_required_date", "is", null)
    .gte("reservation_required_date", fromISO)
    .lte("reservation_required_date", toISO);
  return new Set(
    (data ?? [])
      .map((r) => r.reservation_required_date)
      .filter((d): d is string => Boolean(d)),
  );
}

/** e.g. "Seatings 5:00 PM–9:00 PM, every 30 min." */
export function serviceWindowNote(settings: BookingSettings): string {
  return `Seatings ${formatTime(settings.service_start)}–${formatTime(
    settings.service_end,
  )}, every ${settings.slot_minutes} min.`;
}
