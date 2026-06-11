"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { postsPublicUrl } from "@/lib/url";
import type { DepartmentType } from "@/lib/database.types";

export type EventFormState = { error?: string };

const VALID = new Set<string>(DEPARTMENTS.map((d) => d.value));

const URL_ERROR = "Registration link must be a valid web address.";

/**
 * Normalize an optional registration link to an http(s) URL with a real domain.
 * Tolerates a pasted link with no scheme ("golfgenius.com/…" →
 * "https://golfgenius.com/…") but rejects non-web schemes (mailto:, etc.),
 * malformed schemes ("https:/x"), and bare words ("TBD") that would otherwise
 * silently save as a dead link behind a prominent Register button.
 */
function parseRegistrationUrl(raw: string): { url: string | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { url: null };

  // A scheme is present but it isn't http(s) (covers "mailto:…" and the
  // single-slash "https:/…" typo, which fails the // test).
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return { url: null, error: URL_ERROR };
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { url: null, error: URL_ERROR };
  }
  // Require a dotted hostname with a plausible TLD so "TBD"/"N/A" don't parse
  // as hosts.
  if (!/\.[a-z]{2,}$/i.test(parsed.hostname)) {
    return { url: null, error: URL_ERROR };
  }
  return { url: parsed.toString() };
}

function parseEvent(formData: FormData) {
  const deptRaw = String(formData.get("department") ?? "");
  const registration = parseRegistrationUrl(
    String(formData.get("registration_url") ?? ""),
  );
  return {
    error: registration.error,
    fields: {
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      event_date: String(formData.get("event_date") ?? ""),
      start_time: String(formData.get("start_time") ?? ""),
      end_time: String(formData.get("end_time") ?? "") || null,
      location: String(formData.get("location") ?? "").trim() || null,
      department: VALID.has(deptRaw) ? (deptRaw as DepartmentType) : null,
      registration_url: registration.url,
      fee: String(formData.get("fee") ?? "").trim() || null,
      cover_image_url: postsPublicUrl(String(formData.get("cover_image_url") ?? "")),
      is_highlight: formData.get("is_highlight") === "on",
    },
  };
}

export async function createEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const profile = await requireRole("staff", "admin");
  const { fields, error: parseError } = parseEvent(formData);
  if (parseError) return { error: parseError };
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
  const { fields, error: parseError } = parseEvent(formData);
  if (parseError) return { error: parseError };
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
