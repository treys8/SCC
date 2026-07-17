import { timingSafeEqual } from "node:crypto";
import { notifyPostPublished } from "@/lib/post-notify";
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
 * (which orders by created_at) as if freshly posted, then sends the notification
 * for any post whose author asked for one. Runs every 5 minutes from GitHub
 * Actions (.github/workflows/publish-scheduled-posts.yml — Vercel's Hobby plan
 * only allows daily crons) and is authenticated by a bearer secret so the public
 * can't fire it. Runs under the service role, bypassing RLS.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed if the secret is unset, then compare in constant time.
  if (!secret || !authorized(request.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Select the fields the notification needs from the flip itself, so going live
  // and knowing what to announce stay one atomic step.
  const { data: published, error } = await admin
    .from("posts")
    .update({ status: "published", publish_at: null, created_at: now })
    .eq("status", "scheduled")
    .lte("publish_at", now)
    .select("id, title, content, department, author_id, notify_members");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // notifyPostPublished claims each post before sending, so a retry of this
  // route (or an overlapping run) can't double-notify. Count what it actually
  // sent, not what was asked for — this response is the signal you'd reach for
  // to debug a missing notification, so it mustn't overstate.
  let notified = 0;
  for (const post of (published ?? []).filter((p) => p.notify_members)) {
    if (await notifyPostPublished(post)) notified++;
  }

  return Response.json({ published: published?.length ?? 0, notified });
}
