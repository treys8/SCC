"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { FACILITIES, FACILITY_STATUS_LABEL } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { FacilityStatusType, FacilityType } from "@/lib/database.types";

const VALID_FACILITY = new Set<string>(FACILITIES);
const VALID_STATUS = new Set<string>(Object.keys(FACILITY_STATUS_LABEL));

const MESSAGE_MAX = 120;

/** Refresh both surfaces that render the widget. */
function revalidateFacilityViews() {
  revalidatePath("/");
  revalidatePath("/posts");
}

/**
 * Staff/admin set a facility's status via a one-tap preset. Tapping a preset
 * also clears any custom message — the badge label carries the state, and a
 * stale note ("Cart path only") must not survive a new hold. Writes through the
 * RLS-enforced client (staff have an update policy), mirroring calendar actions.
 */
export async function setFacilityStatus(
  facility: FacilityType,
  status: FacilityStatusType,
) {
  const profile = await requireRole("staff", "admin");
  if (!VALID_FACILITY.has(facility) || !VALID_STATUS.has(status)) {
    throw new Error("Unknown facility or status.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("facility_status")
    .update({ status, message: null, updated_by: profile.id })
    .eq("facility", facility);
  if (error) throw new Error(error.message);

  revalidateFacilityViews();
}

/**
 * Staff/admin set (or clear) a facility's custom message without changing its
 * status — for nuance like "Cart path only" or "Front 9 open".
 */
export async function setFacilityMessage(
  facility: FacilityType,
  message: string,
) {
  const profile = await requireRole("staff", "admin");
  if (!VALID_FACILITY.has(facility)) {
    throw new Error("Unknown facility.");
  }

  const trimmed = message.trim().slice(0, MESSAGE_MAX) || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("facility_status")
    .update({ message: trimmed, updated_by: profile.id })
    .eq("facility", facility);
  if (error) throw new Error(error.message);

  revalidateFacilityViews();
}
