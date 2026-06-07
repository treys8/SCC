"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentType } from "@/lib/database.types";

export type EventFormState = { error?: string };

const VALID = new Set<string>(DEPARTMENTS.map((d) => d.value));

function parseEvent(formData: FormData) {
  const deptRaw = String(formData.get("department") ?? "");
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    event_date: String(formData.get("event_date") ?? ""),
    start_time: String(formData.get("start_time") ?? ""),
    end_time: String(formData.get("end_time") ?? "") || null,
    location: String(formData.get("location") ?? "").trim() || null,
    department: VALID.has(deptRaw) ? (deptRaw as DepartmentType) : null,
  };
}

export async function createEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const profile = await requireRole("staff", "admin");
  const fields = parseEvent(formData);
  if (!fields.title || !fields.event_date || !fields.start_time) {
    return { error: "Title, date, and start time are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_events")
    .insert({ ...fields, created_by: profile.id });
  if (error) return { error: error.message };

  revalidatePath("/calendar");
  revalidatePath("/");
  redirect("/calendar");
}

export async function updateEvent(
  id: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  await requireRole("staff", "admin");
  const fields = parseEvent(formData);
  if (!fields.title || !fields.event_date || !fields.start_time) {
    return { error: "Title, date, and start time are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_events")
    .update(fields)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/calendar");
  revalidatePath("/");
  redirect("/calendar");
}

export async function deleteEvent(id: string) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
  revalidatePath("/");
}
