/**
 * Shared feed querying — used by the server-rendered first page
 * (`/posts/page.tsx`) and the `loadMorePosts` Server Action so both stay in
 * lockstep. Attachments are sorted by `position` in the UI, which keeps this
 * query simple and independent of supabase-js embedded-ordering options.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  DepartmentType,
  FeedPost,
  Post,
} from "@/lib/database.types";

export const FEED_PAGE_SIZE = 10;

/** The trimmed post shape the Today-page teaser renders (no attachments). */
export type PostTeaser = Pick<
  Post,
  "id" | "title" | "content" | "department" | "created_at"
>;

/** Post + its attachments + the author's display fields, in one round trip. */
export const FEED_SELECT =
  "*, post_attachments(*), author:profiles!posts_author_id_fkey(full_name, avatar_url)";

type DB = SupabaseClient<Database>;

export type FeedPage = {
  posts: FeedPost[];
  /** created_at to pass as `before` for the next page, or null when exhausted. */
  nextCursor: string | null;
};

/** All pinned posts (respecting the department filter), newest first. */
export async function fetchPinnedPosts(
  supabase: DB,
  depts: DepartmentType[],
): Promise<FeedPost[]> {
  let q = supabase
    .from("posts")
    .select(FEED_SELECT)
    .eq("is_pinned", true)
    .order("created_at", { ascending: false });
  if (depts.length) q = q.in("department", depts);
  const { data } = await q.returns<FeedPost[]>();
  return data ?? [];
}

/**
 * A page of non-pinned posts, newest first, keyset-paginated by `created_at`
 * (robust against rows shifting as new posts arrive — unlike offset paging).
 */
export async function fetchFeedPage(
  supabase: DB,
  { depts, before }: { depts: DepartmentType[]; before?: string | null },
): Promise<FeedPage> {
  let q = supabase
    .from("posts")
    .select(FEED_SELECT)
    .eq("is_pinned", false)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE + 1);
  if (depts.length) q = q.in("department", depts);
  if (before) q = q.lt("created_at", before);

  const { data } = await q.returns<FeedPost[]>();
  const rows = data ?? [];
  const hasMore = rows.length > FEED_PAGE_SIZE;
  const posts = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? posts[posts.length - 1].created_at : null;
  return { posts, nextCursor };
}

/**
 * The latest few posts (pinned or not), newest first — a lightweight teaser for
 * the Today page that links through to the full feed. Skips the attachment/author
 * join the feed needs since the teaser only shows a title and department.
 */
export async function fetchLatestPosts(
  supabase: DB,
  limit: number,
): Promise<PostTeaser[]> {
  const { data } = await supabase
    .from("posts")
    .select("id, title, content, department, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<PostTeaser[]>();
  return data ?? [];
}

/** Newest-first attachment order for rendering. */
export function sortedAttachments(post: FeedPost) {
  return [...(post.post_attachments ?? [])].sort(
    (a, b) => a.position - b.position,
  );
}
