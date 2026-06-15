/**
 * Member department preferences — stored as **opt-OUT** rows. A row
 * `(user_id, department)` means "do not alert me about this department." A
 * member with no rows receives everything (default-on); a fully-opted-out
 * member has one row per department. This lets a member who unchecks every box
 * actually receive nothing (the old opt-in storage collapsed that to "never
 * configured → default-on").
 *
 * `getDepartmentOptIns` returns the departments a member still wants — the
 * checked state of the profile form (call with the RLS-gated server client).
 * `getUsersForDepartmentDefaultOn` resolves a department alert's audience:
 * everyone who hasn't opted out (call with the service-role admin client so the
 * fan-out sees every member).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEPARTMENTS } from "@/lib/constants";
import type { Database, DepartmentType } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

const ALL_DEPARTMENTS = DEPARTMENTS.map((d) => d.value);

/** Departments a member has opted OUT of (the raw stored rows). */
export async function getDepartmentOptOuts(
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
 * Departments a member still wants alerts from = all minus their opt-outs.
 * This is the checked state shown in the preferences form (all for a member who
 * has opted out of nothing; empty for one who has opted out of everything).
 */
export async function getDepartmentOptIns(
  supabase: DB,
  userId: string,
): Promise<DepartmentType[]> {
  const optedOut = new Set(await getDepartmentOptOuts(supabase, userId));
  return ALL_DEPARTMENTS.filter((d) => !optedOut.has(d));
}

/**
 * Audience for a department alert: every member who hasn't opted out of it.
 * Call with the service-role admin client so the fan-out sees every member.
 *
 * Reads the full member list and computes the set-difference in JS. Fine at
 * club scale (hundreds of members) on this human-paced path; if `profiles` ever
 * grows large, push the anti-join into a SECURITY DEFINER RPC (precedent:
 * set_member_department_preferences) that returns only the recipients.
 */
export async function getUsersForDepartmentDefaultOn(
  supabase: DB,
  department: DepartmentType,
): Promise<string[]> {
  const [{ data: members }, { data: optOuts }] = await Promise.all([
    supabase.from("profiles").select("id"),
    supabase
      .from("member_department_preferences")
      .select("user_id")
      .eq("department", department),
  ]);
  const excluded = new Set((optOuts ?? []).map((r) => r.user_id));
  return (members ?? []).map((m) => m.id).filter((id) => !excluded.has(id));
}
