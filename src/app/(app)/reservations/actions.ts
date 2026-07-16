"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireRole } from "@/lib/auth";
import { notifyUsers, sendPushToUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  effectiveBookingSettings,
  fetchServiceOverride,
  fetchWeeklyClosedWeekdays,
} from "@/lib/dining";
import { formatDate, formatTime } from "@/lib/format";
import {
  fetchReservationSettings,
  validateBookingDay,
  validateBookingSlot,
} from "@/lib/reservations";
import type { ReservationStatus } from "@/lib/database.types";

export type ReservationState = { error?: string; success?: boolean };

/** Member-supplied free text is capped before storage (matches contact/golf). */
const SPECIAL_REQUESTS_MAX = 500;
/** Upper bound on party size; mirrors the form's stepper max. The DB cover-cap
 * trigger is stricter per slot, but this gives a clear message first. */
const MAX_PARTY_SIZE = 50;

export async function createReservation(
  _prev: ReservationState,
  formData: FormData,
): Promise<ReservationState> {
  const profile = await requireProfile();

  const date = String(formData.get("reservation_date") ?? "");
  const time = String(formData.get("reservation_time") ?? "");
  const partySize = Number(formData.get("party_size") ?? 0);
  const special =
    String(formData.get("special_requests") ?? "")
      .trim()
      .slice(0, SPECIAL_REQUESTS_MAX) || null;

  if (!date || !time) return { error: "Choose a date and time." };
  if (!Number.isInteger(partySize) || partySize < 1) {
    return { error: "Party size must be at least 1." };
  }
  if (partySize > MAX_PARTY_SIZE) {
    return { error: `Party size can be at most ${MAX_PARTY_SIZE}.` };
  }

  const supabase = await createClient();
  // The picker only offers valid slots, but the action is the real boundary:
  // validate the date is canonical, not past, within the horizon, that the club
  // is serving that day, and that the time is a real slot for it (a crafted POST
  // can send a non-canonical past date that beats a string compare).
  const [settings, override, weeklyClosed] = await Promise.all([
    fetchReservationSettings(supabase),
    fetchServiceOverride(supabase, date),
    fetchWeeklyClosedWeekdays(supabase),
  ]);
  const dayError = validateBookingDay(date, weeklyClosed, override);
  if (dayError) return { error: dayError };
  const slotError = validateBookingSlot(
    effectiveBookingSettings(settings, override),
    date,
    time,
  );
  if (slotError) return { error: slotError };

  const { error } = await supabase.from("reservations").insert({
    member_id: profile.id,
    reservation_date: date,
    reservation_time: time,
    party_size: partySize,
    special_requests: special,
  });
  if (error) return { error: error.message };

  // They got the table they were waiting for — drop the waiting entry so it
  // can't page them again. Best-effort: never fail a booking over housekeeping.
  await supabase
    .from("reservation_waitlist")
    .delete()
    .eq("member_id", profile.id)
    .eq("reservation_date", date)
    .eq("reservation_time", time);

  revalidatePath("/reservations");
  return { success: true };
}

/** Member cancels their own reservation (RLS scopes to owner). */
export async function cancelReservation(id: string) {
  await requireProfile();
  const supabase = await createClient();
  // .select() so an RLS no-op (a non-owned or stale id matches 0 rows) surfaces
  // as an error instead of a false success — matching deletePost/togglePin.
  // The date/time come back so we can offer the seat to anyone waiting on it.
  const { data, error } = await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("id, reservation_date, reservation_time");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Reservation not found.");

  await notifyWaitlistIfFreed(data[0].reservation_date, data[0].reservation_time);
  revalidatePath("/reservations");
}

/**
 * Staff/admin set a reservation's status. On confirm/decline/cancel the member
 * gets an in-app notification; a decline also records the reason in staff_note.
 *
 * A decline may carry a counter-offer (proposedDate + proposedTime): the FOH
 * manager offers an alternate slot the member can one-tap accept. Both must be
 * present to register an offer; any other status clears a stale offer.
 */
export async function setReservationStatus(
  id: string,
  status: ReservationStatus,
  staffNote?: string,
  proposedDate?: string,
  proposedTime?: string,
) {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const patch: {
    status: ReservationStatus;
    staff_note?: string | null;
    proposed_date?: string | null;
    proposed_time?: string | null;
  } = { status };
  if (status === "declined") {
    // Only a decline carries a member-visible reason.
    patch.staff_note = staffNote?.trim() || null;
    // An optional counter-offer — both parts required, else no offer.
    const pDate = proposedDate?.trim() || null;
    const pTime = proposedTime?.trim() || null;
    const hasOffer = Boolean(pDate && pTime);
    if (hasOffer) {
      // Validate the offered slot now — the slot trigger doesn't fire on the
      // proposed_* columns, so without this a member could be shown an offer
      // that only fails (opaquely) when they tap Accept. That includes the day
      // itself: never offer a time on a day the club isn't serving.
      const [settings, override, weeklyClosed] = await Promise.all([
        fetchReservationSettings(supabase),
        fetchServiceOverride(supabase, pDate!),
        fetchWeeklyClosedWeekdays(supabase),
      ]);
      const offerDayError = validateBookingDay(pDate!, weeklyClosed, override);
      if (offerDayError) throw new Error(`Proposed day invalid: ${offerDayError}`);
      const offerError = validateBookingSlot(
        effectiveBookingSettings(settings, override),
        pDate!,
        pTime!,
      );
      if (offerError) throw new Error(`Proposed time invalid: ${offerError}`);
    }
    patch.proposed_date = hasOffer ? pDate : null;
    patch.proposed_time = hasOffer ? pTime : null;
  } else {
    // Confirm/cancel/back-to-pending: drop any offer that was outstanding.
    patch.proposed_date = null;
    patch.proposed_time = null;
  }

  const { data: row, error } = await supabase
    .from("reservations")
    .update(patch)
    .eq("id", id)
    .select(
      "id, member_id, reservation_date, reservation_time, staff_note, proposed_date, proposed_time",
    )
    .single();
  if (error) throw new Error(error.message);

  // Best-effort: a notification failure (or a missing service-role key) must
  // never surface as a failed status change the staff member already completed.
  try {
    await notifyStatusChange(status, row);
  } catch (e) {
    console.error("reservation notification failed:", e);
  }

  // Declining or cancelling hands the seat back — offer it to anyone waiting.
  if (status === "declined" || status === "cancelled") {
    await notifyWaitlistIfFreed(row.reservation_date, row.reservation_time);
  }

  revalidatePath("/reservations");
}

/**
 * Member accepts the FOH manager's proposed alternate time: the reservation moves
 * to the offered slot and is confirmed in one tap. Runs through the service-role
 * client because the member-update guard only lets a member self-cancel — but the
 * capacity trigger (now firing on UPDATE) still validates the new slot, so an
 * offer into a slot that filled in the meantime is rejected here.
 */
export async function acceptProposedTime(id: string) {
  const profile = await requireProfile();
  const admin = createAdminClient();

  const { data: row, error: readError } = await admin
    .from("reservations")
    .select("id, member_id, status, proposed_date, proposed_time")
    .eq("id", id)
    .single();
  if (readError) throw new Error(readError.message);
  if (!row || row.member_id !== profile.id) {
    throw new Error("Reservation not found.");
  }
  // A live counter-offer only exists on a declined reservation (staff-set). This
  // also blocks a member who tampered proposed_* onto their own row — they can
  // never set status to 'declined' (the member-update guard forbids it).
  if (row.status !== "declined" || !row.proposed_date || !row.proposed_time) {
    throw new Error("There's no proposed time to accept.");
  }

  const { error } = await admin
    .from("reservations")
    .update({
      reservation_date: row.proposed_date,
      reservation_time: row.proposed_time,
      status: "confirmed",
      staff_note: null,
      proposed_date: null,
      proposed_time: null,
      // The booking has moved to a different day, so any reminder already sent
      // was about the old one — clear it, or the new date's cron would skip
      // this member entirely (it only claims rows where reminded_at is null).
      reminded_at: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // No waitlist notification here: the row is 'declined', which stopped
  // consuming capacity the moment it was declined (the trigger ignores
  // non-active statuses) — so the original slot was already handed back then.
  // Accepting takes capacity at the new slot; it frees nothing.
  revalidatePath("/reservations");
}

/** Member declines the proposed alternate ("No thanks"): clear the offer, the
 * reservation stays declined. Service-role for the same guard reason as accept. */
export async function declineProposedTime(id: string) {
  const profile = await requireProfile();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("reservations")
    .select("id, member_id, status")
    .eq("id", id)
    .single();
  if (!row || row.member_id !== profile.id || row.status !== "declined") {
    throw new Error("Reservation not found.");
  }

  const { error } = await admin
    .from("reservations")
    .update({ proposed_date: null, proposed_time: null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/reservations");
}

type NotifiableRow = {
  id: string;
  member_id: string;
  reservation_date: string;
  reservation_time: string;
  staff_note: string | null;
  proposed_date: string | null;
  proposed_time: string | null;
};

/**
 * Insert an in-app notification for the member when staff move a reservation to
 * a terminal state. Best-effort: a notification failure must not undo the status
 * change the staff member just made. Uses the service-role client because
 * `notifications` has no insert RLS policy (server-trusted inserts only).
 */
async function notifyStatusChange(
  status: ReservationStatus,
  row: NotifiableRow,
) {
  const when = `${formatDate(row.reservation_date)} at ${formatTime(
    row.reservation_time,
  )}`;

  let title: string;
  let body: string;
  switch (status) {
    case "confirmed":
      title = "Reservation confirmed";
      body = `Your table for ${when} is confirmed — see you then.`;
      break;
    case "declined":
      if (row.proposed_date && row.proposed_time) {
        // A counter-offer turns a decline into an invitation to re-book.
        const offered = `${formatDate(row.proposed_date)} at ${formatTime(
          row.proposed_time,
        )}`;
        title = "A new time is offered";
        body = row.staff_note
          ? `${when} didn't work (${row.staff_note}) — we can offer ${offered}. Open the app to accept.`
          : `${when} didn't work — we can offer ${offered}. Open the app to accept.`;
      } else {
        title = "Reservation declined";
        body = row.staff_note
          ? `Your request for ${when} was declined: ${row.staff_note}`
          : `Your request for ${when} was declined. Please contact the club for details.`;
      }
      break;
    case "cancelled":
      title = "Reservation cancelled";
      body = `Your reservation for ${when} was cancelled.`;
      break;
    default:
      return; // pending → nothing to announce
  }

  const admin = createAdminClient();
  await admin.from("notifications").insert({
    user_id: row.member_id,
    type: "reservation",
    title,
    body,
    link: "/reservations",
    reservation_id: row.id,
  });

  // Mirror the in-app notification to Web Push (same copy). Best-effort —
  // sendPushToUsers never throws.
  await sendPushToUsers([row.member_id], {
    title,
    body,
    url: "/reservations",
    tag: `reservation-${row.id}`,
  });
}

// ── Waitlist ────────────────────────────────────────────────────────────────

export type WaitlistState = { error?: string; success?: boolean };

/**
 * Join the waitlist for a seating that's already full. Validated exactly like a
 * booking — a member shouldn't be able to wait on a day the club is closed, or
 * on a time that isn't a real seating.
 */
export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const profile = await requireProfile();

  const date = String(formData.get("reservation_date") ?? "");
  const time = String(formData.get("reservation_time") ?? "");
  const partySize = Number(formData.get("party_size") ?? 0);

  if (!date || !time) return { error: "Choose a date and time." };
  if (!Number.isInteger(partySize) || partySize < 1) {
    return { error: "Party size must be at least 1." };
  }
  if (partySize > MAX_PARTY_SIZE) {
    return { error: `Party size can be at most ${MAX_PARTY_SIZE}.` };
  }

  const supabase = await createClient();
  const [settings, override, weeklyClosed] = await Promise.all([
    fetchReservationSettings(supabase),
    fetchServiceOverride(supabase, date),
    fetchWeeklyClosedWeekdays(supabase),
  ]);
  const dayError = validateBookingDay(date, weeklyClosed, override);
  if (dayError) return { error: dayError };
  const slotError = validateBookingSlot(
    effectiveBookingSettings(settings, override),
    date,
    time,
  );
  if (slotError) return { error: slotError };

  const { error } = await supabase.from("reservation_waitlist").insert({
    member_id: profile.id,
    reservation_date: date,
    reservation_time: time,
    party_size: partySize,
  });
  if (error) {
    // The (member, date, time) unique index — they're already waiting.
    if (error.code === "23505") {
      return { error: "You're already on the waitlist for that seating." };
    }
    return { error: error.message };
  }

  revalidatePath("/reservations");
  return { success: true };
}

/** Leave the waitlist (RLS scopes the delete to the owner). */
export async function leaveWaitlist(id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservation_waitlist")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Waitlist entry not found.");
  revalidatePath("/reservations");
}

/**
 * A seating just freed up — tell everyone waiting on it.
 *
 * Everyone is notified at once and the first to book wins: the capacity trigger
 * serializes the race on its per-slot advisory lock, so the club can't oversell
 * however many members tap at the same moment. At club scale that beats an
 * auto-assign or a held table, and needs no timers.
 *
 * Rows are claimed (notified_at) before sending, so a second freeing won't
 * re-notify someone who's already been told — they either booked, or they know.
 *
 * Best-effort: never let a notification failure surface as a failed cancel or
 * decline that the caller has already completed.
 */
async function notifyWaitlistIfFreed(date: string, time: string) {
  try {
    const admin = createAdminClient();

    // Is there actually room now? A decline on a slot that's still full (two
    // parties were over cap) shouldn't tell anyone to come running.
    const { data: avail } = await admin.rpc("get_slot_availability", {
      p_dates: [date],
    });
    const slot = (avail ?? []).find(
      (s) => s.slot_time.slice(0, 5) === time.slice(0, 5),
    );
    if (!slot) return;
    const tablesLeft = slot.max_res - slot.res_count;
    const coversLeft = slot.max_covers - slot.cover_count;
    if (tablesLeft <= 0 || coversLeft <= 0) return;

    const { data: claimed, error } = await admin
      .from("reservation_waitlist")
      .update({ notified_at: new Date().toISOString() })
      .eq("reservation_date", date)
      .eq("reservation_time", time)
      .is("notified_at", null)
      .select("member_id, party_size");
    if (error) {
      console.error("waitlist claim failed:", error.message);
      return;
    }
    // Only tell the members whose party actually fits in what opened up.
    const ids = (claimed ?? [])
      .filter((w) => w.party_size <= coversLeft)
      .map((w) => w.member_id);
    if (ids.length === 0) return;

    await notifyUsers(ids, {
      type: "reservation",
      title: "A table just opened up",
      body: `${formatDate(date)} at ${formatTime(
        time,
      )} has space again — first come, first served.`,
      link: "/reservations",
      tag: `waitlist-${date}-${time}`,
    });
  } catch (e) {
    console.error("notifyWaitlistIfFreed failed:", e);
  }
}
