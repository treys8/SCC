"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentType } from "@/lib/database.types";

const VALID_DEPARTMENT = new Set<string>(DEPARTMENTS.map((d) => d.value));

const NAME_MAX = 80;
const TITLE_MAX = 100;
const EMAIL_MAX = 120;
const PHONE_MAX = 40;

export type StaffInput = {
  id?: string;
  full_name: string;
  title: string;
  email: string | null;
  phone: string | null;
  department: DepartmentType | null;
  sort_order: number;
};

const trimOrNull = (s: string | null, max: number) =>
  (s ?? "").trim().slice(0, max) || null;

/** Refresh both the editor and the member-facing directory. */
function revalidateDirectory() {
  revalidatePath("/manage/directory");
  revalidatePath("/directory");
}

/**
 * Insert (no id) or update (with id) one staff-directory row. Members read this
 * table; the staff/admin write policy lives in the staff_directory migration, so
 * the RLS-enforced client is enough. Returns the row id so the client can adopt
 * a freshly-inserted row without a full refresh.
 */
export async function saveStaffMember(
  input: StaffInput,
): Promise<{ id: string }> {
  await requireRole("staff", "admin");

  const full_name = input.full_name.trim().slice(0, NAME_MAX);
  const title = input.title.trim().slice(0, TITLE_MAX);
  if (!full_name || !title) {
    throw new Error("Name and title are both required.");
  }

  const department =
    input.department && VALID_DEPARTMENT.has(input.department)
      ? input.department
      : null;
  const sort_order = Number.isFinite(input.sort_order)
    ? Math.trunc(input.sort_order)
    : 0;

  const row = {
    full_name,
    title,
    email: trimOrNull(input.email, EMAIL_MAX),
    phone: trimOrNull(input.phone, PHONE_MAX),
    department,
    sort_order,
  };

  const supabase = await createClient();

  if (input.id) {
    const { data, error } = await supabase
      .from("staff_directory")
      .update(row)
      .eq("id", input.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("That staff member no longer exists.");
    revalidateDirectory();
    return { id: data.id };
  }

  const { data, error } = await supabase
    .from("staff_directory")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidateDirectory();
  return { id: data.id };
}

export async function deleteStaffMember(id: string) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_directory")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDirectory();
}
