import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedPushEndpoint } from "@/lib/url";

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

// Web Push caps the encrypted payload near 4 KB; an over-long body (e.g. a
// reservation staff note) would 413 and silently drop. Bound the free-text
// fields so the notification always sends, just trimmed.
const MAX_BODY_CHARS = 480;
const MAX_TITLE_CHARS = 120;

// Prune an endpoint after this many consecutive non-fatal send failures, so
// dead-but-not-410 endpoints don't linger forever (without nuking on a 403).
const MAX_SEND_FAILURES = 8;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function clampPayload(payload: PushPayload): PushPayload {
  return {
    ...payload,
    title: truncate(payload.title, MAX_TITLE_CHARS),
    body: truncate(payload.body, MAX_BODY_CHARS),
  };
}

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
    const { data: allSubs, error } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, failure_count")
      .in("user_id", ids);
    if (error) {
      console.error("push: failed to load subscriptions:", error.message);
      return;
    }
    // Defense in depth: never POST to an endpoint that isn't a known push host
    // (a bad row can't be turned into an outbound SSRF target).
    const subs = (allSubs ?? []).filter((s) => isAllowedPushEndpoint(s.endpoint));
    if (subs.length === 0) return;

    const body = JSON.stringify(clampPayload(payload));
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        ),
      ),
    );

    // Classify outcomes:
    //  • 404/410      → endpoint is gone, prune immediately.
    //  • 403          → batch-wide VAPID/auth failure; NEVER prune (it'd wipe
    //                   the whole table), just log.
    //  • other reject → transient; bump failure_count, prune once it caps out.
    //  • success      → reset a previously-nonzero failure_count.
    const dead: string[] = [];
    const bumped: { endpoint: string; failure_count: number }[] = [];
    const recovered: string[] = [];
    results.forEach((r, i) => {
      const sub = subs[i];
      if (r.status === "fulfilled") {
        if ((sub.failure_count ?? 0) > 0) recovered.push(sub.endpoint);
        return;
      }
      const status = (r.reason as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        dead.push(sub.endpoint);
      } else if (status === 403) {
        console.error("push send failed (VAPID/403, not pruning):", r.reason);
      } else {
        console.error("push send failed:", r.reason);
        const next = (sub.failure_count ?? 0) + 1;
        if (next >= MAX_SEND_FAILURES) dead.push(sub.endpoint);
        else bumped.push({ endpoint: sub.endpoint, failure_count: next });
      }
    });

    if (dead.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", dead);
    }
    if (recovered.length > 0) {
      await admin
        .from("push_subscriptions")
        .update({ failure_count: 0 })
        .in("endpoint", recovered);
    }
    await Promise.all(
      bumped.map((b) =>
        admin
          .from("push_subscriptions")
          .update({ failure_count: b.failure_count })
          .eq("endpoint", b.endpoint),
      ),
    );
  } catch (e) {
    console.error("sendPushToUsers failed:", e);
  }
}

export type NotifyOptions = {
  type: string;
  title: string;
  body: string;
  /** In-app link + push click-through URL (same destination). */
  link: string;
  /** Optional push tag (collapses repeats in the OS tray). */
  tag?: string;
  /** Links the notification to a reservation, so it cascades away with it. */
  reservationId?: string;
};

/**
 * Fan out an in-app notification (one row per user) plus a best-effort Web Push
 * to a set of members — the shared tail behind the contact / cron / etc. notify
 * flows. Uses the service-role client because `notifications` has no insert RLS
 * policy (server-trusted inserts only). De-dupes ids and no-ops on an empty set.
 */
export async function notifyUsers(
  userIds: string[],
  opts: NotifyOptions,
): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert(
    ids.map((id) => ({
      user_id: id,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      link: opts.link,
      ...(opts.reservationId ? { reservation_id: opts.reservationId } : {}),
    })),
  );
  if (error) {
    console.error("notifyUsers: notifications insert failed:", error.message);
  }

  await sendPushToUsers(ids, {
    title: opts.title,
    body: opts.body,
    url: opts.link,
    tag: opts.tag,
  });
}
