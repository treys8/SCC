/**
 * Reservation booking helpers. The DB enforces the service window, slot
 * alignment, and capacity (see 20260607010000_reservations_system.sql); these
 * read the same `reservation_settings` so the booking form only ever offers
 * times the trigger will accept.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { formatTime } from "@/lib/format";

type DB = SupabaseClient<Database>;

export type SlotOption = { value: string; label: string };

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

/** e.g. "Seatings 5:00 PM–9:00 PM, every 30 min." */
export function serviceWindowNote(settings: BookingSettings): string {
  return `Seatings ${formatTime(settings.service_start)}–${formatTime(
    settings.service_end,
  )}, every ${settings.slot_minutes} min.`;
}
