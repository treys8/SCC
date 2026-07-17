"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, requireRole } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/constants";
import { clubTodayISO } from "@/lib/format";
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
      schedule_note: String(formData.get("schedule_note") ?? "").trim() || null,
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
  const { data: created, error } = await supabase
    .from("calendar_events")
    .insert({ ...fields, created_by: profile.id })
    .select("id")
    .single();
  if (error || !created) {
    return { error: error?.message ?? "Could not create the event." };
  }

  // Optional: fan a linked announcement out to the Feed. Best-effort — the event
  // is already saved, so a feed hiccup must never surface as a failed create.
  // Silent like every other post (no push); members see it on the Feed.
  let postedToFeed = false;
  if (formData.get("also_post_to_feed") === "on") {
    const { error: postError } = await supabase.from("posts").insert({
      author_id: profile.id,
      author_type: "club",
      department: fields.department ?? "general",
      title: fields.title,
      content: fields.description ?? "",
      event_id: created.id,
      reservation_cta: false,
      is_pinned: false,
    });
    if (postError) {
      console.error("event feed post failed:", postError.message);
    } else {
      postedToFeed = true;
    }
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  if (postedToFeed) revalidatePath("/posts");
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

// ── RSVPs ───────────────────────────────────────────────────────────────────

/**
 * Member toggles "I'm coming" for a club-run event. The headcount it feeds is
 * staff-only (RLS); the member only ever sees their own answer.
 *
 * Refused for an event with a registration_url — those hand off to GolfGenius,
 * and a second sign-up path would split the count between two systems. Also
 * refused once the event has passed: an RSVP is a statement of intent, and
 * there's nothing left to intend.
 */
export async function setRsvp(eventId: string, going: boolean) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: event, error: readError } = await supabase
    .from("calendar_events")
    .select("id, event_date, registration_url")
    .eq("id", eventId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!event) throw new Error("Event not found.");
  if (event.registration_url) {
    throw new Error("This event is registered through its own sign-up link.");
  }
  if (event.event_date < clubTodayISO()) {
    throw new Error("That event has already passed.");
  }

  if (going) {
    // Idempotent: tapping twice (a double-tap, a stale page) stays one row.
    const { error } = await supabase
      .from("event_rsvps")
      .upsert(
        { event_id: eventId, member_id: profile.id },
        { onConflict: "event_id,member_id" },
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("event_rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("member_id", profile.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/calendar/${eventId}`);
  revalidatePath("/calendar");
}
