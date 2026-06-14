import { CONDITIONS_STALE_HOURS, FACILITY_LABEL } from "@/lib/constants";
import { sendPushToUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FacilityType } from "@/lib/database.types";

// Always run live — this reads the current clock to judge staleness and must
// never be statically cached.
export const dynamic = "force-dynamic";

const STALE_MS = CONDITIONS_STALE_HOURS * 60 * 60 * 1000;

/**
 * Morning reminder: if the club-wide toggle is on and any facility's conditions
 * have gone stale (>24h), nudge every staff/admin in-app + via push to refresh
 * them. Triggered by Vercel Cron (see vercel.json); authenticated by a bearer
 * secret so the public can't fire it. The in-app notification works regardless
 * of VAPID config; push is best-effort on top.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();

  // Respect the club-wide opt-out (seeded on; staff disable once it's routine).
  const { data: settings } = await admin
    .from("club_settings")
    .select("conditions_reminder_enabled")
    .eq("id", true)
    .maybeSingle();
  if (settings && settings.conditions_reminder_enabled === false) {
    return Response.json({ skipped: "disabled" });
  }

  const { data: facilities } = await admin
    .from("facility_status")
    .select("facility, updated_at");
  const stale = (facilities ?? []).filter(
    (f) => Date.now() - new Date(f.updated_at).getTime() > STALE_MS,
  );
  if (stale.length === 0) {
    return Response.json({ skipped: "fresh" });
  }

  const { data: staff } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["staff", "admin"]);
  const staffIds = (staff ?? []).map((s) => s.id);
  if (staffIds.length === 0) {
    return Response.json({ notified: 0, stale: stale.length });
  }

  const names = stale
    .map((f) => FACILITY_LABEL[f.facility as FacilityType])
    .join(", ");
  const title = "Refresh today's conditions";
  const body =
    stale.length === 1
      ? `${names} hasn't been updated in over a day. Tap to refresh it.`
      : `Some conditions haven't been updated in over a day: ${names}.`;

  await admin.from("notifications").insert(
    staffIds.map((id) => ({
      user_id: id,
      type: "conditions_reminder",
      title,
      body,
      link: "/manage/conditions",
    })),
  );

  await sendPushToUsers(staffIds, {
    title,
    body,
    url: "/manage/conditions",
    tag: "conditions-reminder",
  });

  return Response.json({
    notified: staffIds.length,
    stale: stale.map((f) => f.facility),
  });
}
