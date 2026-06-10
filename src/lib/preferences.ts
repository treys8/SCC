/**
 * Member department preferences — the opt-in layer that targets Phase 7 push.
 *
 * `getDepartmentPreferences` reads one member's choices for the profile UI
 * (call it with the RLS-gated server client). `getUsersOptedIntoDepartment`
 * resolves the audience for a department alert (call it with the service-role
 * admin client so the fan-out can see every member, not just the caller).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DepartmentType } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

/** The departments a member has opted into (empty array if none / on error). */
export async function getDepartmentPreferences(
  supabase: DB,
  userId: string,
): Promise<DepartmentType[]> {
  const { data } = await supabase
    .from("member_department_preferences")
    .select("department")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.department);
}

/** All user ids opted into a department — the audience for a department alert. */
export async function getUsersOptedIntoDepartment(
  supabase: DB,
  department: DepartmentType,
): Promise<string[]> {
  const { data } = await supabase
    .from("member_department_preferences")
    .select("user_id")
    .eq("department", department);
  return (data ?? []).map((r) => r.user_id);
}
