"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireRole } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/format";
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
 */
export async function setReservationStatus(
  id: string,
  status: ReservationStatus,
  staffNote?: string,
) {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  const patch: { status: ReservationStatus; staff_note?: string | null } = {
    status,
  };
  // Only a decline carries a member-visible reason.
  if (status === "declined") patch.staff_note = staffNote?.trim() || null;

  const { data: row, error } = await supabase
    .from("reservations")
    .update(patch)
    .eq("id", id)
    .select("id, member_id, reservation_date, reservation_time, staff_note")
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

type NotifiableRow = {
  id: string;
  member_id: string;
  reservation_date: string;
  reservation_time: string;
  staff_note: string | null;
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
      title = "Reservation declined";
      body = row.staff_note
        ? `Your request for ${when} was declined: ${row.staff_note}`
        : `Your request for ${when} was declined. Please contact the club for details.`;
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
