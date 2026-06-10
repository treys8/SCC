"use server";

import { revalidatePath } from "next/cache";
import { DEPARTMENTS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentType } from "@/lib/database.types";

export type ProfileState = { error?: string; success?: boolean };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!fullName) return { error: "Name is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: true };
}

const VALID_DEPARTMENTS = new Set<string>(DEPARTMENTS.map((d) => d.value));

/**
 * Replace the member's department opt-ins with the submitted set. These choices
 * decide which department alerts can reach them via push (Phase 7); safety
 * alerts — lightning holds and closures — reach everyone regardless. Writes
 * through the RLS-gated client, so the member can only ever touch their own
 * rows. Done as delete-all-then-insert because the set is tiny (≤8 rows).
 */
export async function updateDepartmentPreferences(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const selected = formData
    .getAll("department")
    .map(String)
    .filter((d): d is DepartmentType => VALID_DEPARTMENTS.has(d));

  const { error: deleteError } = await supabase
    .from("member_department_preferences")
    .delete()
    .eq("user_id", user.id);
  if (deleteError) return { error: deleteError.message };

  if (selected.length > 0) {
    const { error } = await supabase
      .from("member_department_preferences")
      .insert(selected.map((department) => ({ user_id: user.id, department })));
    if (error) return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}
