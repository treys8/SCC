import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Reads the current clock to decide which scheduled posts are due — never cache.
export const dynamic = "force-dynamic";

/** Constant-time bearer check (avoids a timing side-channel on the secret). */
function authorized(authHeader: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Publish scheduled posts whose time has arrived. Flips due rows to 'published'
 * and bumps created_at to now() so each lands at the top of the member feed
 * (which orders by created_at) as if freshly posted. Triggered by Vercel Cron
 * (see vercel.json) and authenticated by a bearer secret so the public can't
 * fire it. Runs under the service role, bypassing RLS.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed if the secret is unset, then compare in constant time.
  if (!secret || !authorized(request.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: published, error } = await admin
    .from("posts")
    .update({ status: "published", publish_at: null, created_at: now })
    .eq("status", "scheduled")
    .lte("publish_at", now)
    .select("id");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ published: published?.length ?? 0 });
}
