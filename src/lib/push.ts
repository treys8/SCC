import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side Web Push send pipeline. Loads a set of members' subscriptions
 * with the service-role client, sends the payload to each endpoint, and prunes
 * endpoints the push service reports as gone (404/410).
 *
 * Best-effort by contract: this never throws. Callers (facility / reservation
 * status changes) treat push as a side effect that must not fail the primary
 * action, so any error here is logged and swallowed.
 *
 * Must run on the Node.js runtime — `web-push` uses native crypto. Never import
 * this from a Client Component (enforced by `server-only`) or an Edge route.
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where notificationclick should navigate (defaults to "/" in the SW). */
  url?: string;
  /** Stable tag collapses repeats in the OS tray (e.g. "facility-golf"). */
  tag?: string;
  icon?: string;
};

/** Send a push to every subscription owned by the given members. */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  try {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return;

    if (!ensureConfigured()) {
      console.error("Web Push not configured (missing VAPID env); skipping.");
      return;
    }

    const admin = createAdminClient();
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", ids);
    if (error) {
      console.error("push: failed to load subscriptions:", error.message);
      return;
    }
    if (!subs || subs.length === 0) return;

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        ),
      ),
    );

    // Prune endpoints the push service says are gone; log other failures.
    const dead: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const status = (r.reason as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) dead.push(subs[i].endpoint);
        else console.error("push send failed:", r.reason);
      }
    });

    if (dead.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", dead);
    }
  } catch (e) {
    console.error("sendPushToUsers failed:", e);
  }
}
