"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, requireRole } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/constants";
import { clubTodayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { parseRegistrationUrl, postsPublicUrl } from "@/lib/url";
import type { DepartmentType } from "@/lib/database.types";

export type EventFormState = { error?: string };

const VALID = new Set<string>(DEPARTMENTS.map((d) => d.value));

/**
 * Shared shape checks for a submitted event. Both times arrive as "HH:MM" from
 * the same pair of `<input type="time">` fields (the edit form slices stored
 * "HH:MM:SS" values down to five characters), so they're equal-length and
 * zero-padded — a lexicographic compare is an ordering compare.
 *
 * An end at or before the start is refused rather than wrapped: the model has a
 * single `event_date` and no end date, so an event running past midnight can't
 * be represented (see the DTEND note in lib/ics.ts). Saving one would produce an
 * .ics whose DTEND precedes its DTSTART.
 */
function validateEventFields(fields: {
  title: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
}): string | null {
  if (!fields.title || !fields.event_date || !fields.start_time) {
    return "Title, date, and start time are required.";
  }
  if (fields.end_time && fields.end_time <= fields.start_time) {
    return "End time must be after the start time.";
  }
  return null;
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
  const invalid = validateEventFields(fields);
  if (invalid) return { error: invalid };

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
  const invalid = validateEventFields(fields);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_events")
    .update(fields)
    .eq("id", id);
  if (error) return { error: error.message };

  // The detail path is named explicitly even though a Server Function's
  // revalidate currently refreshes every previously visited page. Next's own
  // docs call that blanket behaviour temporary and due to narrow to the given
  // path, at which point an unnamed /calendar/[id] would start serving stale
  // copy. Cheap now, correct later.
  revalidatePath("/calendar");
  revalidatePath(`/calendar/${id}`);
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
  revalidatePath(`/calendar/${id}`);
  revalidatePath("/");
}

// ── RSVPs ───────────────────────────────────────────────────────────────────

export type RsvpState = { error?: string };

/**
 * Member toggles "I'm coming" for a club-run event. The headcount it feeds is
 * staff-only (RLS); the member only ever sees their own answer.
 *
 * A *new* RSVP is refused for an event with a registration_url — those hand off
 * to GolfGenius, and a second sign-up path would split the count between two
 * systems. Withdrawing is always allowed though: staff can add a sign-up link to
 * an event members have already answered, and stranding them on a list they
 * can't leave is worse than the split count we're avoiding. Both directions are
 * refused once the event has passed: an RSVP is a statement of intent, and
 * there's nothing left to intend.
 *
 * Refusals are returned, not thrown — they're expected outcomes, and Next
 * replaces thrown Server Action messages with a generic string in production,
 * so a thrown one would never reach the member. Mirrors `joinWaitlist`.
 */
export async function setRsvp(
  eventId: string,
  going: boolean,
): Promise<RsvpState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: event, error: readError } = await supabase
    .from("calendar_events")
    .select("id, event_date, registration_url")
    .eq("id", eventId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!event) return { error: "Event not found." };
  if (going && event.registration_url) {
    return { error: "This event is registered through its own sign-up link." };
  }
  if (event.event_date < clubTodayISO()) {
    return { error: "That event has already passed." };
  }

  if (going) {
    // Idempotent: tapping twice (a double-tap, a stale page) stays one row.
    // ignoreDuplicates gives ON CONFLICT DO NOTHING, which is checked against
    // the INSERT policy alone. The default (DO UPDATE) would be checked against
    // an UPDATE policy — and this table deliberately has none, so re-tapping
    // would raise an RLS violation at a member who is already on the list.
    const { error } = await supabase
      .from("event_rsvps")
      .upsert(
        { event_id: eventId, member_id: profile.id },
        { onConflict: "event_id,member_id", ignoreDuplicates: true },
      );
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("event_rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("member_id", profile.id);
    if (error) return { error: error.message };
  }

  revalidatePath(`/calendar/${eventId}`);
  revalidatePath("/calendar");
  return {};
}
