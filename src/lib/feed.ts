/**
 * Shared feed querying — used by the server-rendered first page
 * (`/posts/page.tsx`) and the `loadMorePosts` Server Action so both stay in
 * lockstep. Attachments are sorted by `position` in the UI, which keeps this
 * query simple and independent of supabase-js embedded-ordering options.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { clubDayEndExclusiveUTC, clubDayStartUTC } from "@/lib/format";
import type {
  Database,
  DepartmentType,
  FeedPost,
  Post,
  PostAuthor,
} from "@/lib/database.types";

export const FEED_PAGE_SIZE = 10;

/**
 * Post + its attachments + any referenced calendar event. The event embeds
 * directly (calendar_events RLS is open to all members), but the author's
 * name/avatar are resolved separately via `member_cards` (see `attachAuthors`):
 * the `profiles` table is readable only by self + staff, so a member viewing a
 * staff-authored post can't embed-join it.
 */
export const FEED_SELECT = "*, post_attachments(*), event:calendar_events(*)";

type DB = SupabaseClient<Database>;
type PostRow = Post & {
  post_attachments: FeedPost["post_attachments"];
  event: FeedPost["event"];
};

/**
 * Resolve each post's author display fields from the `member_cards` view (name +
 * avatar only, member-readable) and attach them in the shape the feed renders.
 */
async function attachAuthors(
  supabase: DB,
  rows: PostRow[],
): Promise<FeedPost[]> {
  const ids = [...new Set(rows.map((r) => r.author_id).filter(Boolean))];
  const byId = new Map<string, PostAuthor>();
  if (ids.length) {
    const { data: cards } = await supabase
      .from("member_cards")
      .select("id, full_name, avatar_url, title")
      .in("id", ids);
    for (const c of cards ?? []) {
      if (c.id && c.full_name != null) {
        byId.set(c.id, {
          full_name: c.full_name,
          avatar_url: c.avatar_url,
          title: c.title,
        });
      }
    }
  }
  return rows.map((r) => ({ ...r, author: byId.get(r.author_id) ?? null }));
}

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
  const { data } = await q.returns<PostRow[]>();
  return attachAuthors(supabase, data ?? []);
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

  const { data } = await q.returns<PostRow[]>();
  const rows = data ?? [];
  const hasMore = rows.length > FEED_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].created_at : null;
  const posts = await attachAuthors(supabase, pageRows);
  return { posts, nextCursor };
}

/** Filters for the staff post search (shared by the page and load-more action). */
export type PostSearchFilters = {
  q?: string;
  depts: DepartmentType[];
  /** Inclusive created_at lower bound, "YYYY-MM-DD" or null. */
  from?: string | null;
  /** Inclusive created_at upper bound, "YYYY-MM-DD" or null (covers the whole day). */
  to?: string | null;
};

/**
 * Strip PostgREST-structural characters from a user search term so it can't
 * corrupt or inject the `.or()` filter string (commas separate filters, parens
 * group them, backslash escapes). The remainder is matched as a `%term%` ILIKE
 * substring. `%` / `_` / `*` are intentionally left intact — they act as ILIKE
 * wildcards inside the value (broadening the match), which is harmless for a
 * search box and can't break out of the value.
 */
export function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()\\]/g, " ").trim();
}

/**
 * Staff post search — all posts (pinned included, unlike the member feed),
 * newest first, keyset-paginated by `created_at`. Composes an optional keyword
 * (ILIKE over title + content), the department filter, and a created_at date
 * range. Staff want every matching post, so this does not filter on `is_pinned`.
 */
export async function searchPosts(
  supabase: DB,
  {
    q,
    depts,
    from,
    to,
    before,
  }: PostSearchFilters & { before?: string | null },
): Promise<FeedPage> {
  let query = supabase
    .from("posts")
    .select(FEED_SELECT)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE + 1);

  const term = sanitizeSearch(q ?? "");
  if (term) query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
  if (depts.length) query = query.in("department", depts);
  // Translate the date-only bounds to UTC instants at club-time day boundaries
  // (created_at is timestamptz) so the range matches the club's day, not the
  // server's UTC day. `to` is an exclusive next-club-day start (no end gap).
  if (from) query = query.gte("created_at", clubDayStartUTC(from));
  if (to) query = query.lt("created_at", clubDayEndExclusiveUTC(to));
  if (before) query = query.lt("created_at", before);

  const { data } = await query.returns<PostRow[]>();
  const rows = data ?? [];
  const hasMore = rows.length > FEED_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].created_at : null;
  const posts = await attachAuthors(supabase, pageRows);
  return { posts, nextCursor };
}

/** Newest-first attachment order for rendering. */
export function sortedAttachments(post: FeedPost) {
  return [...(post.post_attachments ?? [])].sort(
    (a, b) => a.position - b.position,
  );
}
