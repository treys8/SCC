import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAllowedPushEndpoint } from "@/lib/url";

// Bound how many browsers one member can register, so a leaked/looping client
// can't bloat the table. Oldest rows are pruned once a member exceeds this.
const MAX_SUBSCRIPTIONS_PER_USER = 20;

/**
 * Persist a browser's Web Push subscription for the signed-in member.
 *
 * We authenticate with the cookie client, then write with the service-role
 * client so the upsert can re-bind an endpoint that a *different* member
 * previously registered on a shared device (an RLS update gated on the existing
 * row's owner would reject that). The endpoint is unique, so upserting on it
 * keeps one row per browser.
 *
 * Hardening: the endpoint must be an https URL on a known push-service host
 * (rejects junk/SSRF targets), and we cap rows per member. The shared-device
 * transfer is kept deliberately — see MAX_SUBSCRIPTIONS_PER_USER.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { subscription, userAgent } = (body ?? {}) as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    userAgent?: string;
  };
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return new Response("Invalid subscription", { status: 400 });
  }
  if (!isAllowedPushEndpoint(endpoint)) {
    return new Response("Unsupported push endpoint", { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: typeof userAgent === "string" ? userAgent.slice(0, 400) : null,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("push subscribe failed:", error.message);
    return new Response("Could not save subscription", { status: 500 });
  }

  // Cap rows per member: drop the oldest beyond the limit (keeps newest browsers).
  const { data: rows } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (rows && rows.length > MAX_SUBSCRIPTIONS_PER_USER) {
    const stale = rows.slice(MAX_SUBSCRIPTIONS_PER_USER).map((r) => r.id);
    await admin.from("push_subscriptions").delete().in("id", stale);
  }

  return Response.json({ ok: true });
}
