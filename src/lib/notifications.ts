import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Notification } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

export const NOTIFICATIONS_PAGE_SIZE = 30;

export type NotificationsPage = {
  items: Notification[];
  nextCursor: string | null;
};

/**
 * A keyset page of the member's notifications, newest first — older than
 * `before` when given. Mirrors fetchFeedPage's `created_at` cursor (robust
 * against new rows arriving between pages, unlike offset paging).
 */
export async function fetchNotificationsPage(
  supabase: DB,
  userId: string,
  before?: string | null,
): Promise<NotificationsPage> {
  let q = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATIONS_PAGE_SIZE + 1);
  if (before) q = q.lt("created_at", before);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const hasMore = rows.length > NOTIFICATIONS_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, NOTIFICATIONS_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;
  return { items, nextCursor };
}
