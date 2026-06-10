/**
 * Shared facility-status querying — used by the server-rendered pages
 * (`/posts`, the staff dashboard) that seed the realtime widget. Returns the
 * facilities in a stable display order (golf, then pool) regardless of row
 * order, so the widget renders consistently.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { FACILITIES } from "@/lib/constants";
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
