"use server";

import { revalidatePath } from "next/cache";
import { requireTitle } from "@/lib/auth";
import { clubTodayISO } from "@/lib/format";
import { sendPushToUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { postsPublicUrl, postsStoragePathFromUrl } from "@/lib/url";
import type { GolfLogKind } from "@/lib/database.types";

const SUPERINTENDENT = "Golf Course Superintendent";
const LEADERSHIP_TITLES = ["General Manager", "Director of Golf"];
// Everyone who can see / comment on the log.
const LOG_TITLES = [SUPERINTENDENT, ...LEADERSHIP_TITLES];

const NOTE_MAX = 2000;

function snippet(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * The superintendent (or an admin) logs a "done" item or an "issue". The entry is
 * shared with course leadership (GM + Director of Golf) via an in-app
 * notification + push, best-effort.
 */
export async function createLogEntry(input: {
  kind: GolfLogKind;
  area: string | null;
  note: string;
  photoUrl: string | null;
}): Promise<void> {
  const profile = await requireTitle(SUPERINTENDENT);
  const note = input.note.trim();
  if (!note) throw new Error("Add a note.");
  if (input.kind !== "done" && input.kind !== "issue") {
    throw new Error("Choose Done or Issue.");
  }

  // A client-supplied URL is only trusted when it points at our posts bucket
  // (where uploadEventCover writes) — never an arbitrary off-origin link.
  const photoUrl = input.photoUrl ? postsPublicUrl(input.photoUrl) : null;

  const supabase = await createClient();
  const { data: entry, error } = await supabase
    .from("golf_log_entries")
    .insert({
      author_id: profile.id,
      entry_date: clubTodayISO(),
      kind: input.kind,
      area: input.area?.trim() || null,
      note: note.slice(0, NOTE_MAX),
      photo_url: photoUrl,
    })
    .select("id, kind, note")
    .single();
  if (error) throw new Error(error.message);

  try {
    await notifyLeadership(profile.full_name, entry.kind, entry.note);
  } catch (e) {
    console.error("golf log notification failed:", e);
  }

  revalidatePath("/manage/golf-log");
}

/** Author (or admin) marks an issue resolved / reopens it. */
export async function setIssueResolved(
  id: string,
  resolved: boolean,
): Promise<void> {
  await requireTitle(SUPERINTENDENT);
  const supabase = await createClient();
  const { error } = await supabase
    .from("golf_log_entries")
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/manage/golf-log");
}

/**
 * Course leadership (or the entry's author) comments on an entry. Notifies the
 * entry author of a reply, unless they wrote the comment themselves.
 */
export async function addLogComment(
  entryId: string,
  body: string,
): Promise<void> {
  const profile = await requireTitle(...LOG_TITLES);
  const text = body.trim();
  if (!text) throw new Error("Write a comment.");

  const supabase = await createClient();
  const { error } = await supabase.from("golf_log_comments").insert({
    entry_id: entryId,
    author_id: profile.id,
    body: text.slice(0, NOTE_MAX),
  });
  if (error) throw new Error(error.message);

  try {
    await notifyEntryAuthor(entryId, profile.id, profile.full_name, text);
  } catch (e) {
    console.error("golf log comment notification failed:", e);
  }

  revalidatePath("/manage/golf-log");
}

/** Resolve GM + Director of Golf profile ids and alert them to a new entry. */
async function notifyLeadership(
  authorName: string,
  kind: GolfLogKind,
  note: string,
): Promise<void> {
  const admin = createAdminClient();
  const ids = await profileIdsForTitles(admin, LEADERSHIP_TITLES);
  if (!ids.length) return;

  const title =
    kind === "issue" ? "New course issue logged" : "Course log updated";
  const body = `${authorName}: ${snippet(note)}`;

  await admin.from("notifications").insert(
    ids.map((id) => ({
      user_id: id,
      type: "golf_log",
      title,
      body,
      link: "/manage/golf-log",
    })),
  );
  await sendPushToUsers(ids, {
    title,
    body,
    url: "/manage/golf-log",
    tag: "golf-log",
  });
}

async function notifyEntryAuthor(
  entryId: string,
  commenterId: string,
  commenterName: string,
  text: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: entry } = await admin
    .from("golf_log_entries")
    .select("author_id")
    .eq("id", entryId)
    .single();
  if (!entry || entry.author_id === commenterId) return;

  const title = "New comment on your log";
  const body = `${commenterName}: ${snippet(text)}`;
  await admin.from("notifications").insert({
    user_id: entry.author_id,
    type: "golf_log",
    title,
    body,
    link: "/manage/golf-log",
  });
  await sendPushToUsers([entry.author_id], {
    title,
    body,
    url: "/manage/golf-log",
    tag: `golf-log-${entryId}`,
  });
}

/** Profile ids holding any of the given staff titles (service-role read). */
async function profileIdsForTitles(
  admin: ReturnType<typeof createAdminClient>,
  titleNames: string[],
): Promise<string[]> {
  const { data: titles } = await admin
    .from("staff_titles")
    .select("id")
    .in("name", titleNames);
  const titleIds = (titles ?? []).map((t) => t.id);
  if (!titleIds.length) return [];

  const { data: people } = await admin
    .from("profiles")
    .select("id")
    .in("title_id", titleIds);
  return (people ?? []).map((p) => p.id);
}

/**
 * Share a log entry with members: publishes it as a normal golf post in the
 * club's voice, carrying the entry's photo across.
 *
 * A copy, deliberately — not a live view of the entry. The log is the
 * superintendent's private working record; once something is published, a later
 * edit to that record must not silently rewrite what members already read. The
 * post is theirs to edit or delete from then on like any other.
 *
 * Written through the member's own client, not the service role: the
 * superintendent is staff (posts_insert_staff_admin), so RLS permits the insert
 * and there's no reason to reach for elevated privileges. requireTitle gates who
 * may share; RLS still has the last word.
 *
 * The photo already lives in the public posts bucket (uploadEventCover put it
 * there), so it's re-used in place — no copy, no second upload.
 */
export async function shareEntryWithMembers(entryId: string): Promise<void> {
  const profile = await requireTitle(SUPERINTENDENT);
  const supabase = await createClient();

  // Title-based RLS on golf_log_entries is what makes this readable.
  const { data: entry, error: readError } = await supabase
    .from("golf_log_entries")
    .select("id, area, note, photo_url")
    .eq("id", entryId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!entry) throw new Error("Log entry not found.");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: profile.id,
      author_type: "club",
      department: "golf",
      title: entry.area ? `From the course — ${entry.area}` : "From the course",
      content: entry.note,
      status: "published",
      source_golf_log_entry_id: entry.id,
    })
    .select("id")
    .single();
  if (error) {
    // The partial unique index on source_golf_log_entry_id.
    if (error.code === "23505") throw new Error("That's already been shared.");
    throw new Error(error.message);
  }

  // Carry the photo over as an attachment. Best-effort: the update is already
  // published and worth reading without the picture.
  const storagePath = postsStoragePathFromUrl(entry.photo_url);
  if (entry.photo_url && storagePath) {
    const { error: attError } = await supabase.from("post_attachments").insert({
      post_id: post.id,
      kind: "image",
      url: entry.photo_url,
      storage_path: storagePath,
      position: 0,
    });
    if (attError) console.error("course update photo failed:", attError.message);
  }

  revalidatePath("/manage/golf-log");
  revalidatePath("/posts");
  revalidatePath("/");
}
