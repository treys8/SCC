"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  FACILITIES,
  FACILITY_LABEL,
  FACILITY_STATUS_LABEL,
} from "@/lib/constants";
import { getUsersForDepartmentDefaultOn } from "@/lib/preferences";
import { sendPushToUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  DepartmentType,
  DishKind,
  FacilityDetail,
  FacilityStatusType,
  FacilityType,
} from "@/lib/database.types";

const VALID_FACILITY = new Set<string>(FACILITIES);
const VALID_STATUS = new Set<string>(Object.keys(FACILITY_STATUS_LABEL));

/**
 * The opt-in department a facility's alerts fan out to. Golf/pool/tennis each
 * own a department; the driving range has none of its own (the enum is
 * golf/dining/tennis/general/…), so it rides the golf opt-in — the range is
 * golf-adjacent, and a member who wants golf alerts wants range alerts too.
 */
const FACILITY_DEPARTMENT: Record<FacilityType, DepartmentType> = {
  golf: "golf",
  driving_range: "golf",
  pool: "pool",
  tennis: "tennis",
};

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
  const { data: prev, error: prevError } = await supabase
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
  try {
    if (prevError) {
      // Couldn't read the prior status — fail OPEN and force-send rather than
      // risk swallowing a safety change (e.g. a lightning hold) or its all-clear.
      await notifyFacilityChange(facility, status, status, { forceAll: true });
    } else if (prev && prev.status !== status) {
      await notifyFacilityChange(facility, status, prev.status);
    }
  } catch (e) {
    console.error("facility notification failed:", e);
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
  opts: { forceAll?: boolean } = {},
) {
  const admin = createAdminClient();

  // Force-send when entering OR leaving a safety state (so the de-escalation
  // reaches the same broad audience the alarm did), or when the caller asks
  // (e.g. the prior status couldn't be read).
  const forceAll =
    opts.forceAll || FORCE_SEND_ALL.has(status) || FORCE_SEND_ALL.has(prevStatus);

  let targetIds: string[];
  if (forceAll) {
    const { data } = await admin.from("profiles").select("id");
    targetIds = (data ?? []).map((r) => r.id);
  } else {
    // Map the facility to its alert department (driving range → golf). Default-on:
    // reaches everyone who hasn't explicitly opted out of that department.
    targetIds = await getUsersForDepartmentDefaultOn(
      admin,
      FACILITY_DEPARTMENT[facility],
    );
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

const DETAIL_LABEL_MAX = 24;
const DETAIL_VALUE_MAX = 60;
const MAX_DETAILS = 6;

/**
 * Staff/admin set a facility's conditions detail rows — the labelled list shown
 * under its status on the Today page (Carts / Greens / Tee sheet, etc.). The
 * whole list is replaced on save; rows missing a label or value are dropped, and
 * the count + lengths are capped server-side so the card can't be overrun. Like a
 * status change, this is an UPDATE on facility_status, so it streams to any open
 * member surface via realtime (the subscription carries every column); a reload
 * isn't required. Unlike a status change, it sends no push notification.
 */
export async function setFacilityDetails(
  facility: FacilityType,
  details: FacilityDetail[],
) {
  const profile = await requireRole("staff", "admin");
  if (!VALID_FACILITY.has(facility)) {
    throw new Error("Unknown facility.");
  }
  if (!Array.isArray(details)) {
    throw new Error("Invalid details.");
  }

  const clean: FacilityDetail[] = details
    .map((d) => ({
      label: String(d?.label ?? "")
        .trim()
        .slice(0, DETAIL_LABEL_MAX),
      value: String(d?.value ?? "")
        .trim()
        .slice(0, DETAIL_VALUE_MAX),
    }))
    .filter((d) => d.label && d.value)
    .slice(0, MAX_DETAILS);

  const supabase = await createClient();
  const { error } = await supabase
    .from("facility_status")
    .update({ details: clean, updated_by: profile.id })
    .eq("facility", facility);
  if (error) throw new Error(error.message);

  revalidateFacilityViews();
}

/**
 * Staff/admin toggle the club-wide morning reminder that nudges staff to refresh
 * stale conditions. Updates the seeded club_settings singleton by id = true
 * (mirrors setBuffet); the cron reads this flag and stays quiet when it's off.
 */
export async function setConditionsReminderEnabled(enabled: boolean) {
  const profile = await requireRole("staff", "admin");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_settings")
    .update({ conditions_reminder_enabled: enabled, updated_by: profile.id })
    .eq("id", true)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Club settings row is missing.");

  revalidatePath("/manage/conditions");
}

const trimOrNull = (s: string | null, max: number) =>
  (s ?? "").trim().slice(0, max) || null;

/** Accept "HH:MM" / "HH:MM:SS" from a time input; anything else becomes null. */
const normalizeTime = (t: string | null) =>
  t && /^\d{2}:\d{2}(:\d{2})?$/.test(t.trim()) ? t.trim().slice(0, 5) : null;

type BuffetInput = {
  title: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  price: string | null;
  description: string | null;
  walk_in: boolean;
  active: boolean;
};

/**
 * Staff/admin edit the single lunch-buffet row that drives the Today page's
 * featured dining card. `active` hides the card on days with no buffet. The row
 * is seeded by migration and only ever updated (singleton table), so there's no
 * insert path. Not realtime — the home page reflects it on next load.
 */
export async function setBuffet(input: BuffetInput) {
  const profile = await requireRole("staff", "admin");

  const clean = {
    title: input.title.trim().slice(0, 80) || "Lunch Buffet",
    start_time: normalizeTime(input.start_time),
    end_time: normalizeTime(input.end_time),
    location: trimOrNull(input.location, 80),
    price: trimOrNull(input.price, 40),
    description: trimOrNull(input.description, 200),
    walk_in: Boolean(input.walk_in),
    active: Boolean(input.active),
    updated_by: profile.id,
  };

  const supabase = await createClient();
  // The singleton row is seeded by migration and there's no insert path, so a
  // 0-row update means it's gone — surface that instead of reporting success.
  const { data, error } = await supabase
    .from("dining_buffet")
    .update(clean)
    .eq("id", true)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Buffet row is missing.");

  revalidateDiningViews();
}

/**
 * Staff/admin edit the single Sunday-brunch row that drives the Today page's
 * brunch card (shown only on Sundays). Mirrors setBuffet exactly — a seeded
 * singleton, update-only — against the dining_brunch table. Not realtime.
 */
export async function setBrunch(input: BuffetInput) {
  const profile = await requireRole("staff", "admin");

  const clean = {
    title: input.title.trim().slice(0, 80) || "Sunday Brunch",
    start_time: normalizeTime(input.start_time),
    end_time: normalizeTime(input.end_time),
    location: trimOrNull(input.location, 80),
    price: trimOrNull(input.price, 40),
    description: trimOrNull(input.description, 200),
    walk_in: Boolean(input.walk_in),
    active: Boolean(input.active),
    updated_by: profile.id,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dining_brunch")
    .update(clean)
    .eq("id", true)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Brunch row is missing.");

  revalidateDiningViews();
}

// ── Weekly buffet: dish catalog + recurring weekday plan ─────────────────────

const DISH_NAME_MAX = 80;
const DAY_NOTE_MAX = 120;
const VALID_DISH_KIND = new Set<DishKind>(["main", "side"]);

/** Also refresh the staff editor so a save lands without a manual reload. */
function revalidateDiningViews() {
  revalidateFacilityViews();
  revalidatePath("/manage/dining");
}

type BuffetDayInput = {
  mainDishId: string | null;
  sideDishIds: string[];
  note: string | null;
  isClosed: boolean;
};

/**
 * Staff/admin set one weekday's buffet: its main dish, its sides, a note, and
 * whether the club is closed that day. The seven rows are seeded by migration,
 * so the day itself is only ever updated; sides are replaced wholesale (clear
 * then re-insert in order) since the set is small and editing is all-or-nothing.
 */
export async function setBuffetDay(weekday: number, input: BuffetDayInput) {
  const profile = await requireRole("staff", "admin");
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw new Error("Unknown weekday.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("buffet_week")
    .update({
      main_dish_id: input.mainDishId || null,
      note: trimOrNull(input.note, DAY_NOTE_MAX),
      is_closed: Boolean(input.isClosed),
      updated_by: profile.id,
    })
    .eq("weekday", weekday)
    .select("weekday")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Buffet day is missing.");

  // Replace the day's sides. De-dupe and cap defensively; the picker only
  // offers valid dish ids, and bad ids are rejected by the FK anyway.
  const sideIds = [...new Set(input.sideDishIds.filter(Boolean))].slice(0, 12);

  const { error: delError } = await supabase
    .from("buffet_week_sides")
    .delete()
    .eq("weekday", weekday);
  if (delError) throw new Error(delError.message);

  if (sideIds.length > 0) {
    const { error: insError } = await supabase
      .from("buffet_week_sides")
      .insert(
        sideIds.map((dish_id, position) => ({ weekday, dish_id, position })),
      );
    if (insError) throw new Error(insError.message);
  }

  revalidateDiningViews();
}

/** Add one dish to the catalog. Duplicate (name, kind) is surfaced, not hidden. */
export async function createDish(name: string, kind: DishKind) {
  const profile = await requireRole("staff", "admin");
  if (!VALID_DISH_KIND.has(kind)) throw new Error("Unknown dish kind.");
  const clean = name.trim().slice(0, DISH_NAME_MAX);
  if (!clean) throw new Error("A dish needs a name.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("dishes")
    .insert({ name: clean, kind, created_by: profile.id });
  if (error) {
    // 23505 = unique_violation on (lower(name), kind).
    if (error.code === "23505") throw new Error(`"${clean}" is already on the list.`);
    throw new Error(error.message);
  }

  revalidateDiningViews();
}

/**
 * Bulk-seed the catalog from a pasted list — one dish per line. Blank lines and
 * within-paste duplicates are dropped, and names already in the catalog (of this
 * kind, case-insensitive) are skipped before insert so the returned count is the
 * number actually added. The unique index on (lower(name), kind) is the backstop.
 */
export async function bulkAddDishes(text: string, kind: DishKind): Promise<number> {
  const profile = await requireRole("staff", "admin");
  if (!VALID_DISH_KIND.has(kind)) throw new Error("Unknown dish kind.");

  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of text.split("\n")) {
    const clean = line.trim().slice(0, DISH_NAME_MAX);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(clean);
  }
  if (names.length === 0) return 0;

  const supabase = await createClient();

  // Drop names already in the catalog (case-insensitive) so we don't trip the
  // unique index and so the count reflects only new additions.
  const { data: existing, error: existingError } = await supabase
    .from("dishes")
    .select("name")
    .eq("kind", kind);
  if (existingError) throw new Error(existingError.message);
  const have = new Set((existing ?? []).map((d) => d.name.toLowerCase()));
  const fresh = names.filter((n) => !have.has(n.toLowerCase()));
  if (fresh.length === 0) return 0;

  const { data, error } = await supabase
    .from("dishes")
    .insert(fresh.map((name) => ({ name, kind, created_by: profile.id })))
    .select("id");
  if (error) throw new Error(error.message);

  revalidateDiningViews();
  return data?.length ?? 0;
}

/** Soft enable/disable a dish — kept out of the picker, but schedule refs survive. */
export async function setDishActive(id: string, active: boolean) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("dishes")
    .update({ active: Boolean(active) })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateDiningViews();
}
