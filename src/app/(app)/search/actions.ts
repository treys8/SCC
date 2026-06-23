"use server";

import { requireProfile } from "@/lib/auth";
import { searchPosts, type FeedPage } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";

/**
 * Next page of member search results for posts (keyset cursor). Any signed-in
 * member may load more — unlike the staff `loadMoreSearchPosts`, which is
 * role-gated. Posts are member-readable under RLS, so the same `searchPosts`
 * query is safe here; documents/events are capped and don't paginate.
 */
export async function loadMoreMemberSearchPosts(
  q: string,
  before: string,
): Promise<FeedPage> {
  await requireProfile();
  const supabase = await createClient();
  return searchPosts(supabase, { q, depts: [], from: null, to: null, before });
}
