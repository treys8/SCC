"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

/** Staff/admin set any reservation's status. */
export async function setReservationStatus(
  id: string,
  status: ReservationStatus,
) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/reservations");
}
