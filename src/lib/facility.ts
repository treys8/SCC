/**
 * Shared facility-status querying — used by the server-rendered pages
 * (`/posts`, the staff dashboard) that seed the realtime widget. Returns the
 * facilities in a stable display order (golf, then pool) regardless of row
 * order, so the widget renders consistently.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONDITIONS_STALE_HOURS, FACILITIES } from "@/lib/constants";
import type { Database, FacilityStatus } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

export async function fetchFacilityStatus(
  supabase: DB,
): Promise<FacilityStatus[]> {
  const { data } = await supabase.from("facility_status").select("*");
  const rows = data ?? [];
  // Stable order: golf first, pool second; drop anything unexpected.
  return FACILITIES.map((f) => rows.find((r) => r.facility === f)).filter(
    (r): r is FacilityStatus => Boolean(r),
  );
}

const STALE_MS = CONDITIONS_STALE_HOURS * 60 * 60 * 1000;

/** A facility whose conditions haven't been refreshed within the freshness window. */
export function isConditionsStale(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() > STALE_MS;
}

/** True when any facility is stale — drives the staff tile badge / row pills. */
export function anyConditionsStale(rows: FacilityStatus[]): boolean {
  return rows.some((r) => isConditionsStale(r.updated_at));
}

/**
 * The club-wide settings singleton (one seeded row). Returns the reminder flag,
 * defaulting to on if the row is somehow missing — mirrors fetchReservationSettings.
 */
export async function fetchClubSettings(
  supabase: DB,
): Promise<{ conditions_reminder_enabled: boolean }> {
  const { data } = await supabase
    .from("club_settings")
    .select("conditions_reminder_enabled")
    .eq("id", true)
    .maybeSingle();
  return data ?? { conditions_reminder_enabled: true };
}
