/**
 * Member-facing search across documents and events. Posts reuse the existing
 * `searchPosts` from `lib/feed.ts` (it already keyword-matches + keyset-paginates
 * and is member-readable under RLS). All three share the PostgREST-safe
 * `sanitizeSearch` term cleaner so a stray comma/paren can't break the `.or()`
 * filter.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeSearch } from "@/lib/feed";
import type {
  CalendarEvent,
  Database,
  DocumentRow,
} from "@/lib/database.types";

type DB = SupabaseClient<Database>;

/**
 * Cap on the non-paginated result groups (documents, events) on the member
 * search page. Posts paginate via keyset; these two are small enough to bound.
 */
export const SEARCH_GROUP_LIMIT = 20;

/**
 * Published documents whose title or file name match the term (ILIKE substring),
 * newest first. `is_published` is enforced here as well as by RLS so a draft
 * never surfaces. A blank/structural-only term short-circuits to no query.
 */
export async function searchDocuments(
  supabase: DB,
  q: string,
): Promise<DocumentRow[]> {
  const term = sanitizeSearch(q);
  if (!term) return [];
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("is_published", true)
    .or(`title.ilike.%${term}%,file_name.ilike.%${term}%`)
    .order("created_at", { ascending: false })
    .limit(SEARCH_GROUP_LIMIT)
    .returns<DocumentRow[]>();
  return data ?? [];
}

/**
 * Calendar events whose title, description, or location match the term, most
 * recent/upcoming first (by event_date). calendar_events RLS is open to members.
 */
export async function searchEvents(
  supabase: DB,
  q: string,
): Promise<CalendarEvent[]> {
  const term = sanitizeSearch(q);
  if (!term) return [];
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .or(
      `title.ilike.%${term}%,description.ilike.%${term}%,location.ilike.%${term}%`,
    )
    .order("event_date", { ascending: false })
    .limit(SEARCH_GROUP_LIMIT)
    .returns<CalendarEvent[]>();
  return data ?? [];
}
