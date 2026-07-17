/**
 * Dining service overrides — the club's exceptions to the derived schedule.
 *
 * Normal service is computed, not stored: Fri/Sat dinner from
 * `isStandingReservationDay`, Sunday brunch from the weekday, the lunch buffet
 * from `buffet_week`. Two things override that, in this order:
 *
 *   1. a `dining_service_overrides` row for the date — 'closed' (no dining) or
 *      'special' (a named service that REPLACES normal service that day);
 *   2. the standing weekly rule in `club_settings.weekly_closed_weekdays`
 *      (ISO weekdays, defaults to Mondays).
 *
 * A date row of either kind beats the weekly rule, which is what makes "closed
 * Mondays except Memorial Day" expressible without generating rows.
 *
 * This precedence is mirrored by enforce_reservation_slot() in
 * 20260716020000_dining_service_overrides.sql — the DB is the authority (it's
 * what rejects a crafted booking); these helpers keep the UI honest so members
 * are never offered a time the trigger will refuse. Keep the two in step.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { clubWeekday } from "@/lib/format";
import type { BookingSettings } from "@/lib/reservations";
import type { Database, DiningServiceOverride } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

/** What's happening for dining on a given club date. */
export type DiningDayStatus = "normal" | "closed" | "special";

/** Overrides for [fromISO, toISO], keyed by ISO date. */
export async function fetchServiceOverrides(
  supabase: DB,
  fromISO: string,
  toISO: string,
): Promise<Map<string, DiningServiceOverride>> {
  const { data } = await supabase
    .from("dining_service_overrides")
    .select("*")
    .gte("date", fromISO)
    .lte("date", toISO);
  return new Map((data ?? []).map((o) => [o.date, o]));
}

/** A single date's override, or null. */
export async function fetchServiceOverride(
  supabase: DB,
  iso: string,
): Promise<DiningServiceOverride | null> {
  const { data } = await supabase
    .from("dining_service_overrides")
    .select("*")
    .eq("date", iso)
    .maybeSingle();
  return data;
}

/**
 * The weekdays the club is closed every week (ISO: 1=Mon … 7=Sun). Falls back to
 * Mondays if the settings row can't be read, matching the column default — a
 * failed read shouldn't quietly start taking Monday bookings.
 */
export async function fetchWeeklyClosedWeekdays(
  supabase: DB,
): Promise<number[]> {
  const { data } = await supabase
    .from("club_settings")
    .select("weekly_closed_weekdays")
    .eq("id", true)
    .maybeSingle();
  return data?.weekly_closed_weekdays ?? [1];
}

/**
 * Settings as they apply to one date: a special day's hours and caps replace the
 * club's, and anything it leaves NULL inherits. Slot cadence is deliberately not
 * overridable — an override changes when service runs and how full it gets, not
 * the grid it sits on (mirrors the trigger).
 */
export function effectiveBookingSettings(
  base: BookingSettings,
  override?: DiningServiceOverride | null,
): BookingSettings {
  if (!override || override.kind !== "special") return base;
  return {
    slot_minutes: base.slot_minutes,
    service_start: override.service_start ?? base.service_start,
    service_end: override.service_end ?? base.service_end,
    max_reservations_per_slot:
      override.max_reservations_per_slot ?? base.max_reservations_per_slot,
    max_covers_per_slot:
      override.max_covers_per_slot ?? base.max_covers_per_slot,
  };
}

/** Dining status for a club date, applying override-then-weekly-rule precedence. */
export function dayDiningStatus(
  iso: string,
  weeklyClosed: number[],
  override?: DiningServiceOverride | null,
): DiningDayStatus {
  if (override) return override.kind === "closed" ? "closed" : "special";
  return weeklyClosed.includes(clubWeekday(iso)) ? "closed" : "normal";
}
