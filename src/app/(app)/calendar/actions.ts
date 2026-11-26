"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, requireRole } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/constants";
import { MAX_EVENT_PARTY, parseCapacity } from "@/lib/events";
import { clubLocalToInstantUTC, clubTodayISO, formatDate } from "@/lib/format";
import { notifyUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const capacity = parseCapacity(String(formData.get("capacity") ?? ""));
  // "Sign up by" arrives as club wall-clock from a datetime-local input.
  const deadlineRaw = String(formData.get("signup_deadline") ?? "").trim();
  const signupDeadline = deadlineRaw ? clubLocalToInstantUTC(deadlineRaw) : null;
  const deadlineError =
    deadlineRaw && !signupDeadline ? "Sign-up deadline isn't a valid date and time." : undefined;
  return {
    error: registration.error ?? capacity.error ?? deadlineError,
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
      capacity: capacity.value,
      signup_deadline: signupDeadline,
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

  // A raised capacity (or a cleared cap) can open spots for people waiting.
  await notifyEventWaitlistIfFreed(id);

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

type RsvpEvent = {
  id: string;
  title: string;
  event_date: string;
  registration_url: string | null;
  capacity: number | null;
  signup_deadline: string | null;
};

async function readRsvpEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<{ event?: RsvpEvent; error?: string }> {
  const { data: event, error } = await supabase
    .from("calendar_events")
    .select("id, title, event_date, registration_url, capacity, signup_deadline")
    .eq("id", eventId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!event) return { error: "Event not found." };
  return { event };
}

function validParty(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_EVENT_PARTY;
}

function deadlinePassed(event: RsvpEvent): boolean {
  return !!event.signup_deadline && Date.now() > Date.parse(event.signup_deadline);
}

/**
 * Member signs up for (or withdraws from) a club-run event, with a party size.
 *
 * Calling with `going` and a party size either creates the RSVP or changes the
 * party on an existing one. Growing a party is a new claim on spots, so it's
 * checked like a sign-up (deadline, capacity); shrinking or withdrawing is
 * always allowed — trapping someone on a list is worse than an empty seat the
 * waitlist can fill.
 *
 * A *new* RSVP is refused for an event with a registration_url — those hand off
 * to GolfGenius, and a second sign-up path would split the count. Both
 * directions are refused once the event has passed.
 *
 * The cap itself is enforced by enforce_event_rsvp() under a per-event lock;
 * its refusal text ("Only 2 spots left for this event.") is written for members
 * and returned as-is.
 *
 * Refusals are returned, not thrown — Next replaces thrown Server Action
 * messages with a generic string in production.
 */
export async function setRsvp(
  eventId: string,
  going: boolean,
  partySize = 1,
): Promise<RsvpState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { event, error: readError } = await readRsvpEvent(supabase, eventId);
  if (!event) return { error: readError };
  if (event.event_date < clubTodayISO()) {
    return { error: "That event has already passed." };
  }

  const { data: existing } = await supabase
    .from("event_rsvps")
    .select("party_size")
    .eq("event_id", eventId)
    .eq("member_id", profile.id)
    .maybeSingle();

  if (!going) {
    if (existing) {
      const { error } = await supabase
        .from("event_rsvps")
        .delete()
        .eq("event_id", eventId)
        .eq("member_id", profile.id);
      if (error) return { error: error.message };
      await notifyEventWaitlistIfFreed(eventId);
    }
    revalidateEvent(eventId);
    return {};
  }

  if (!validParty(partySize)) {
    return { error: `Party size must be between 1 and ${MAX_EVENT_PARTY}.` };
  }
  if (!existing && event.registration_url) {
    return { error: "This event is registered through its own sign-up link." };
  }
  const growing = !existing || partySize > existing.party_size;
  if (growing && deadlinePassed(event)) {
    return { error: "Sign-ups for this event have closed." };
  }

  if (existing) {
    if (existing.party_size !== partySize) {
      const { error } = await supabase
        .from("event_rsvps")
        .update({ party_size: partySize })
        .eq("event_id", eventId)
        .eq("member_id", profile.id);
      if (error) return { error: error.message };
      if (partySize < existing.party_size) await notifyEventWaitlistIfFreed(eventId);
    }
  } else {
    const { error } = await supabase
      .from("event_rsvps")
      .insert({ event_id: eventId, member_id: profile.id, party_size: partySize });
    // 23505: a double-tap already created the row — they're on the list.
    if (error && error.code !== "23505") return { error: error.message };
  }

  // They're in — a waiting entry would only page them again.
  await supabase
    .from("event_waitlist")
    .delete()
    .eq("event_id", eventId)
    .eq("member_id", profile.id);

  revalidateEvent(eventId);
  return {};
}

/**
 * Join the waitlist for a capped event that can't fit this party right now.
 * Validated like a sign-up (not past, not after the deadline, not a
 * GolfGenius-linked event) and refused when there's actually room — then the
 * member should just sign up.
 */
export async function joinEventWaitlist(
  eventId: string,
  partySize: number,
): Promise<RsvpState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { event, error: readError } = await readRsvpEvent(supabase, eventId);
  if (!event) return { error: readError };
  if (event.event_date < clubTodayISO()) {
    return { error: "That event has already passed." };
  }
  if (event.registration_url || event.capacity == null) {
    return { error: "This event doesn't have a waitlist." };
  }
  if (deadlinePassed(event)) {
    return { error: "Sign-ups for this event have closed." };
  }
  if (!validParty(partySize)) {
    return { error: `Party size must be between 1 and ${MAX_EVENT_PARTY}.` };
  }

  const { data: avail } = await supabase.rpc("get_event_availability", {
    p_event_id: eventId,
  });
  const row = avail?.[0];
  if (row && row.capacity - row.taken >= partySize) {
    return { error: "There's room now — sign up instead." };
  }

  const { error } = await supabase.from("event_waitlist").insert({
    event_id: eventId,
    member_id: profile.id,
    party_size: partySize,
  });
  if (error && error.code !== "23505") return { error: error.message };

  revalidateEvent(eventId);
  return {};
}

/** Leave an event's waitlist (RLS scopes the delete to the owner). */
export async function leaveEventWaitlist(eventId: string): Promise<RsvpState> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_waitlist")
    .delete()
    .eq("event_id", eventId)
    .eq("member_id", profile.id);
  if (error) return { error: error.message };
  revalidateEvent(eventId);
  return {};
}

function revalidateEvent(eventId: string) {
  revalidatePath(`/calendar/${eventId}`);
  revalidatePath("/calendar");
}

/**
 * Spots just freed on a capped event — tell everyone waiting whose party fits.
 *
 * Mirrors notifyWaitlistIfFreed for dinner: everyone who fits is told at once
 * and the first to sign up wins (enforce_event_rsvp serializes the race). The
 * party filter is part of the claim, so a party too big for the gap is never
 * stamped notified_at and stays eligible for a later, bigger opening.
 *
 * No-op after the deadline or the event date (the spot can't be taken), and
 * best-effort: never fails the withdraw/edit that triggered it.
 */
async function notifyEventWaitlistIfFreed(eventId: string) {
  try {
    const admin = createAdminClient();
    const { data: event } = await admin
      .from("calendar_events")
      .select("id, title, event_date, registration_url, capacity, signup_deadline")
      .eq("id", eventId)
      .maybeSingle();
    if (!event || event.registration_url) return;
    if (event.event_date < clubTodayISO() || deadlinePassed(event)) return;

    let spotsLeft = MAX_EVENT_PARTY; // uncapped now: anyone waiting fits
    if (event.capacity != null) {
      const { data: avail } = await admin.rpc("get_event_availability", {
        p_event_id: eventId,
      });
      const row = avail?.[0];
      if (!row) return;
      spotsLeft = row.capacity - row.taken;
    }
    if (spotsLeft <= 0) return;

    const { data: claimed, error } = await admin
      .from("event_waitlist")
      .update({ notified_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .is("notified_at", null)
      .lte("party_size", spotsLeft)
      .select("member_id");
    if (error) {
      console.error("event waitlist claim failed:", error.message);
      return;
    }
    const ids = (claimed ?? []).map((w) => w.member_id);
    if (ids.length === 0) return;

    const ok = await notifyUsers(ids, {
      type: "event",
      title: "A spot just opened up",
      body: `${event.title} (${formatDate(event.event_date)}) has room again — first come, first served.`,
      link: `/calendar/${eventId}`,
      tag: `event-waitlist-${eventId}`,
    });
    if (!ok) {
      await admin
        .from("event_waitlist")
        .update({ notified_at: null })
        .eq("event_id", eventId)
        .in("member_id", ids);
    }
  } catch (e) {
    console.error("notifyEventWaitlistIfFreed failed:", e);
  }
}
