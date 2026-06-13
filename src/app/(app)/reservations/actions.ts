"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireRole } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { clubTodayISO, formatDate, formatTime } from "@/lib/format";
import type { ReservationStatus } from "@/lib/database.types";

export type ReservationState = { error?: string; success?: boolean };

export async function createReservation(
  _prev: ReservationState,
  formData: FormData,
): Promise<ReservationState> {
  const profile = await requireProfile();

  const date = String(formData.get("reservation_date") ?? "");
  const time = String(formData.get("reservation_time") ?? "");
  const partySize = Number(formData.get("party_size") ?? 0);
  const special =
    String(formData.get("special_requests") ?? "").trim() || null;

  if (!date || !time) return { error: "Choose a date and time." };
  // The HTML `min` is only a hint; enforce no past dates server-side too.
  if (date < clubTodayISO()) {
    return { error: "Choose a date that hasn't already passed." };
  }
  if (!Number.isInteger(partySize) || partySize < 1) {
    return { error: "Party size must be at least 1." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reservations").insert({
    member_id: profile.id,
    reservation_date: date,
    reservation_time: time,
    party_size: partySize,
    special_requests: special,
  });
  if (error) return { error: error.message };

  revalidatePath("/reservations");
  return { success: true };
}

/** Member cancels their own reservation (RLS scopes to owner). */
export async function cancelReservation(id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) throw new Error(error.message);
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
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

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
