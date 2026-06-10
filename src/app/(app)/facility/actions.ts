"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  FACILITIES,
  FACILITY_LABEL,
  FACILITY_STATUS_LABEL,
} from "@/lib/constants";
import { getUsersOptedIntoDepartment } from "@/lib/preferences";
import { sendPushToUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Read the prior status first so we only alert on an actual change.
  const { data: prev } = await supabase
    .from("facility_status")
    .select("status")
    .eq("facility", facility)
    .single();

  const { error } = await supabase
    .from("facility_status")
    .update({ status, message: null, updated_by: profile.id })
    .eq("facility", facility);
  if (error) throw new Error(error.message);

  revalidateFacilityViews();

  // Best-effort: a real status change alerts members (in-app + push). A failure
  // here must never surface as a failed status change the staff already made.
  if (prev && prev.status !== status) {
    try {
      await notifyFacilityChange(facility, status, prev.status);
    } catch (e) {
      console.error("facility notification failed:", e);
    }
  }
}

// One-liner body per status; safety states reach everyone (see FORCE_SEND_ALL).
const FACILITY_ALERT_BODY: Record<
  FacilityStatusType,
  (label: string) => string
> = {
  open: (l) => `${l} is open.`,
  closed: (l) => `${l} is now closed.`,
  frost_delay: (l) => `${l} is on a frost delay.`,
  rain_delay: (l) => `${l} is on a rain delay.`,
  lightning_hold: (l) =>
    `Lightning in the area — ${l} is on hold. Please seek shelter.`,
};

// Statuses urgent enough to override member preferences and reach everyone.
const FORCE_SEND_ALL = new Set<FacilityStatusType>(["lightning_hold", "closed"]);

/**
 * Fan a facility status change out to members: an in-app notification row plus
 * a Web Push, with the same copy. Audience is the facility's department opt-ins
 * (golf → 'golf', pool → 'pool'), except safety states (lightning / closure)
 * which reach every member regardless of preferences. The all-clear that ends a
 * safety state reaches everyone too — so whoever got the alarm also gets the
 * resolution, not just the opted-in. Uses the service-role client so the
 * fan-out sees all members and bypasses the notifications insert policy
 * (server-trusted writes only).
 */
async function notifyFacilityChange(
  facility: FacilityType,
  status: FacilityStatusType,
  prevStatus: FacilityStatusType,
) {
  const admin = createAdminClient();

  // Force-send when entering OR leaving a safety state, so the de-escalation
  // reaches the same broad audience the alarm did.
  const forceAll = FORCE_SEND_ALL.has(status) || FORCE_SEND_ALL.has(prevStatus);

  let targetIds: string[];
  if (forceAll) {
    const { data } = await admin.from("profiles").select("id");
    targetIds = (data ?? []).map((r) => r.id);
  } else {
    // FacilityType ('golf' | 'pool') is a subset of DepartmentType.
    targetIds = await getUsersOptedIntoDepartment(admin, facility);
  }
  if (targetIds.length === 0) return;

  const label = FACILITY_LABEL[facility];
  const title = `${label}: ${FACILITY_STATUS_LABEL[status]}`;
  const body = FACILITY_ALERT_BODY[status](label);

  await admin.from("notifications").insert(
    targetIds.map((id) => ({
      user_id: id,
      type: "facility",
      title,
      body,
      link: "/",
    })),
  );

  await sendPushToUsers(targetIds, {
    title,
    body,
    url: "/",
    tag: `facility-${facility}`,
  });
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
