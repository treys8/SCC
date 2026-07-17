import "server-only";
import { getUsersForDepartmentDefaultOn } from "@/lib/preferences";
import { notifyUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DepartmentType } from "@/lib/database.types";

/**
 * Fan out "a new post is live" to the members who want that department.
 *
 * Two paths publish a post — the createPost/updatePost actions (publish now, or
 * a draft/scheduled post edited into published) and the cron that flips due
 * scheduled posts. Both call this, so the send has to be idempotent: it claims
 * the post first (UPDATE ... WHERE notified_at IS NULL) and bails unless that
 * claim returned the row. A cron retry, a re-edit, or the two racing therefore
 * yield exactly one push.
 *
 * Best-effort by contract, like the rest of the notify pipeline: a failure here
 * is logged, never thrown — publishing must not fail because push did.
 */

export type PublishedPost = {
  id: string;
  title: string | null;
  content: string;
  department: DepartmentType;
  author_id: string;
};

/** Push bodies are plain text; strip the Markdown so it reads cleanly in the tray. */
const PREVIEW_CHARS = 120;

function preview(content: string): string {
  const plain = content
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links/images → their label
    .replace(/[*_`>#]/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > PREVIEW_CHARS
    ? `${plain.slice(0, PREVIEW_CHARS - 1)}…`
    : plain;
}

/** True when this call is the one that sent — false if it was already claimed
 * or the claim failed. Lets the cron report sends rather than intentions. */
export async function notifyPostPublished(post: PublishedPost): Promise<boolean> {
  try {
    const admin = createAdminClient();

    // Claim first: whoever flips notified_at from NULL owns the send.
    const { data: claimed, error: claimError } = await admin
      .from("posts")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", post.id)
      .is("notified_at", null)
      .select("id");
    if (claimError) {
      console.error("notifyPostPublished: claim failed:", claimError.message);
      return false;
    }
    if (!claimed || claimed.length === 0) return false; // already sent

    // Everyone who hasn't opted out of this department, minus the author (they
    // just wrote it — a push telling them about their own post is noise).
    const audience = (
      await getUsersForDepartmentDefaultOn(admin, post.department)
    ).filter((id) => id !== post.author_id);
    if (audience.length === 0) return true; // claimed and settled: nobody to tell

    const body = preview(post.content);
    await notifyUsers(audience, {
      type: "post",
      title: post.title?.trim() || "New from the club",
      // A title-only post (photo + headline) would otherwise push an empty body.
      body: body || "Tap to read the latest update.",
      link: `/posts/${post.id}`,
      tag: `post-${post.id}`,
    });
    return true;
  } catch (e) {
    console.error("notifyPostPublished failed:", e);
    return false;
  }
}
