import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Persist a browser's Web Push subscription for the signed-in member.
 *
 * We authenticate with the cookie client, then write with the service-role
 * client so the upsert can re-bind an endpoint that a *different* member
 * previously registered on a shared device (an RLS update gated on the existing
 * row's owner would reject that). The endpoint is unique, so upserting on it
 * keeps one row per browser.
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
  if (error) return new Response(error.message, { status: 500 });

  return Response.json({ ok: true });
}
