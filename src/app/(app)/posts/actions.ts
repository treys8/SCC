"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, requireRole } from "@/lib/auth";
import {
  fetchFeedPage,
  fetchPinnedPosts,
  type FeedPage,
} from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";
import { postsObjectUrl, postsPublicUrl } from "@/lib/url";
import type {
  DepartmentType,
  FeedPost,
  PostAuthorType,
} from "@/lib/database.types";

const BUCKET = "posts";

export type PostActionResult = { error?: string };

/** Attachment metadata produced by the browser uploader (see lib/upload.ts). */
export type AttachmentInput = {
  kind: "image" | "file";
  url: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
};

export type CreatePostInput = {
  department: DepartmentType;
  authorType: PostAuthorType;
  title: string;
  content: string;
  isPinned: boolean;
  /** Optional calendar event this post links to (renders its Register button). */
  eventId: string | null;
  /** Show a "Reserve a table" button linking to the dining reservation flow. */
  reservationCta: boolean;
  attachments: AttachmentInput[];
};

export type UpdatePostInput = CreatePostInput & {
  /** ids of existing attachments to remove (row + Storage object). */
  removedAttachmentIds: string[];
};

function sanitizeText(input: CreatePostInput) {
  return {
    department: input.department,
    // Anything but an explicit 'member' is the club's voice (the safe default).
    authorType: (input.authorType === "member"
      ? "member"
      : "club") as PostAuthorType,
    title: (input.title ?? "").trim(),
    content: (input.content ?? "").trim(),
    isPinned: !!input.isPinned,
    eventId: input.eventId || null,
    reservationCta: !!input.reservationCta,
    attachments: (input.attachments ?? []).filter(
      (a) =>
        (a.kind === "image" || a.kind === "file") && !!a.url && !!a.storage_path,
    ),
  };
}

function attachmentRows(
  postId: string,
  attachments: AttachmentInput[],
  startPosition = 0,
) {
  return attachments.map((a, i) => ({
    post_id: postId,
    kind: a.kind,
    // The url is client-supplied; only persist one that points at our public
    // posts bucket, else re-derive it from the (in-bucket) storage_path so a
    // crafted off-origin link can't be stored and rendered into an <a href>.
    url: postsPublicUrl(a.url) ?? postsObjectUrl(a.storage_path) ?? a.url,
    storage_path: a.storage_path,
    file_name: a.file_name || null,
    mime_type: a.mime_type || null,
    size_bytes: a.size_bytes || null,
    width: a.width,
    height: a.height,
    position: startPosition + i,
  }));
}

export async function createPost(
  input: CreatePostInput,
): Promise<PostActionResult> {
  const profile = await requireRole("staff", "admin");
  const {
    department,
    authorType,
    title,
    content,
    isPinned,
    eventId,
    reservationCta,
    attachments,
  } = sanitizeText(input);

  if (!title && !content && attachments.length === 0) {
    return { error: "Add a title, some text, or at least one attachment." };
  }

  const supabase = await createClient();

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      author_id: profile.id,
      author_type: authorType,
      department,
      title: title || null,
      content,
      event_id: eventId,
      reservation_cta: reservationCta,
      is_pinned: isPinned,
    })
    .select("id")
    .single();
  if (postError || !post) {
    return { error: postError?.message ?? "Could not publish the post." };
  }

  if (attachments.length > 0) {
    const { error: attError } = await supabase
      .from("post_attachments")
      .insert(attachmentRows(post.id, attachments));
    if (attError) {
      // Compensate: drop the post we just created so we don't leave a partial.
      await supabase.from("posts").delete().eq("id", post.id);
      return { error: `Couldn't save attachments: ${attError.message}` };
    }
  }

  revalidatePath("/posts");
  revalidatePath("/");
  redirect("/posts");
}

export async function updatePost(
  id: string,
  input: UpdatePostInput,
): Promise<PostActionResult> {
  const profile = await requireRole("staff", "admin");
  const {
    department,
    authorType,
    title,
    content,
    isPinned,
    eventId,
    reservationCta,
    attachments,
  } = sanitizeText(input);
  const removedIds = (input.removedAttachmentIds ?? []).filter(Boolean);

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("posts")
    .select("id, author_id")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Announcement not found." };
  if (existing.author_id !== profile.id) {
    return { error: "You can only edit your own posts." };
  }

  const { data: current } = await supabase
    .from("post_attachments")
    .select("id, storage_path, position")
    .eq("post_id", id);
  const removedSet = new Set(removedIds);
  const kept = (current ?? []).filter((a) => !removedSet.has(a.id));

  if (!title && !content && kept.length + attachments.length === 0) {
    return { error: "Add a title, some text, or at least one attachment." };
  }

  const { error: upError } = await supabase
    .from("posts")
    .update({
      department,
      author_type: authorType,
      title: title || null,
      content,
      event_id: eventId,
      reservation_cta: reservationCta,
      is_pinned: isPinned,
    })
    .eq("id", id);
  if (upError) return { error: upError.message };

  // Remove de-selected attachments: DB rows first, then Storage objects.
  if (removedSet.size > 0) {
    const removedPaths = (current ?? [])
      .filter((a) => removedSet.has(a.id))
      .map((a) => a.storage_path)
      .filter(Boolean);
    await supabase.from("post_attachments").delete().in("id", [...removedSet]);
    if (removedPaths.length) {
      await supabase.storage.from(BUCKET).remove(removedPaths);
    }
  }

  // Append new attachments after whatever is kept.
  if (attachments.length > 0) {
    const maxPos = kept.reduce((m, a) => Math.max(m, a.position), -1);
    const { error: attError } = await supabase
      .from("post_attachments")
      .insert(attachmentRows(id, attachments, maxPos + 1));
    if (attError) return { error: attError.message };
  }

  revalidatePath("/posts");
  revalidatePath("/");
  redirect("/posts");
}

export async function deletePost(id: string) {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  // Gather Storage paths before the rows cascade away.
  const { data: atts } = await supabase
    .from("post_attachments")
    .select("storage_path")
    .eq("post_id", id);

  // RLS scopes deletes to the author; .select() lets us tell "deleted" from
  // "row hidden by RLS" so we don't report success (or wipe Storage) on a no-op.
  const { data: deleted, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!deleted || deleted.length === 0) {
    throw new Error("You can only delete your own posts.");
  }

  const paths = (atts ?? []).map((a) => a.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);

  revalidatePath("/posts");
  revalidatePath("/");
}

export async function togglePin(id: string, isPinned: boolean) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("posts")
    .update({ is_pinned: isPinned })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    // Staff may pin any post (RLS: posts_update_staff), so a 0-row result here
    // means the post is gone, not a permission problem.
    throw new Error("That post no longer exists.");
  }
  revalidatePath("/posts");
  revalidatePath("/");
}

/** Infinite-scroll: next page of non-pinned posts. Any member may load more. */
export async function loadMorePosts(
  depts: DepartmentType[],
  before: string,
): Promise<FeedPage> {
  await requireProfile();
  const supabase = await createClient();
  return fetchFeedPage(supabase, { depts, before });
}

/** Reload the top of the feed (pinned + first page) — used by the "new posts" pill. */
export async function refreshFeed(
  depts: DepartmentType[],
): Promise<{ pinned: FeedPost[]; page: FeedPage }> {
  await requireProfile();
  const supabase = await createClient();
  const [pinned, page] = await Promise.all([
    fetchPinnedPosts(supabase, depts),
    fetchFeedPage(supabase, { depts, before: null }),
  ]);
  return { pinned, page };
}
