import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Remove a browser's Web Push subscription for the signed-in member. Scoped to
 * (endpoint, user_id) so a member only ever deletes their own row. The browser
 * also calls PushSubscription.unsubscribe() client-side.
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

  const { endpoint } = (body ?? {}) as { endpoint?: string };
  if (!endpoint) return new Response("Missing endpoint", { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) {
    console.error("push unsubscribe failed:", error.message);
    return new Response("Could not remove subscription", { status: 500 });
  }

  return Response.json({ ok: true });
}
