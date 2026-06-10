/**
 * Member department preferences — the opt-in layer that targets Phase 7 push.
 *
 * `getDepartmentPreferences` reads one member's choices for the profile UI
 * (call it with the RLS-gated server client). `getUsersForDepartmentDefaultOn`
 * resolves the audience for a department alert under the default-on model (call
 * it with the service-role admin client so the fan-out can see every member).
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

/**
 * Audience for a department alert under the **default-on** model: every member
 * EXCEPT those who have configured preferences that exclude this department. A
 * member who never set any preference receives everything; one who saved a list
 * without this department has explicitly opted out. Call with the service-role
 * client so the fan-out sees every member.
 */
export async function getUsersForDepartmentDefaultOn(
  supabase: DB,
  department: DepartmentType,
): Promise<string[]> {
  const [{ data: members }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("id"),
    supabase.from("member_department_preferences").select("user_id, department"),
  ]);
  const configured = new Set<string>();
  const optedIn = new Set<string>();
  for (const p of prefs ?? []) {
    configured.add(p.user_id);
    if (p.department === department) optedIn.add(p.user_id);
  }
  return (members ?? [])
    .map((m) => m.id)
    .filter((id) => !configured.has(id) || optedIn.has(id));
}
