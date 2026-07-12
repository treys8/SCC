import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { ManagePostsResults } from "@/components/manage-posts-results";
import { ManagePostsSearch } from "@/components/manage-posts-search";
import { PageHeader } from "@/components/page-header";
import { DEPARTMENTS } from "@/lib/constants";
import { searchPosts } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentType, PostStatus } from "@/lib/database.types";

export const metadata: Metadata = { title: "Posts" };

const VALID = new Set<string>(DEPARTMENTS.map((d) => d.value));

function parseDepts(raw?: string): DepartmentType[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => VALID.has(s)) as DepartmentType[];
}

// Accept only YYYY-MM-DD so a malformed ?from=/&to= can't reach the query.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function parseDate(raw?: string): string {
  return raw && DATE_RE.test(raw) ? raw : "";
}

const STATUSES = new Set<string>(["draft", "scheduled", "published"]);
function parseStatus(raw?: string): PostStatus | null {
  return raw && STATUSES.has(raw) ? (raw as PostStatus) : null;
}

/**
 * Staff post search & management. Reads the keyword / department / date-range
 * filters from the URL, runs `searchPosts`, and hands the first page to the
 * client results list (which appends more via the load-more action). Each result
 * links to the existing edit flow — staff/admin can edit any post. Gated to
 * staff/admin by the /manage layout.
 */
export default async function ManagePostsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    dept?: string;
    from?: string;
    to?: string;
    status?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const depts = parseDepts(sp.dept);
  const from = parseDate(sp.from);
  const to = parseDate(sp.to);
  const status = parseStatus(sp.status);

  const filters = { q, depts, from: from || null, to: to || null, status };

  const supabase = await createClient();
  const page = await searchPosts(supabase, { ...filters, before: null });

  const hasFilters = !!(q || depts.length || from || to || status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Posts"
        description="Search every announcement; open one to edit, re-pin, or update it."
      />

      <ManagePostsSearch
        q={q}
        depts={depts}
        from={from}
        to={to}
        status={status}
      />

      {page.posts.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No posts match" : "No posts yet"}
          description={
            hasFilters
              ? "Try a different keyword, category, or date range."
              : "Announcements will appear here once they’re posted."
          }
        />
      ) : (
        <ManagePostsResults
          // Re-key on filter change so the loaded-pages state resets cleanly.
          key={`${q}|${depts.join(",")}|${from}|${to}|${status ?? ""}`}
          initialPosts={page.posts}
          initialCursor={page.nextCursor}
          filters={filters}
        />
      )}
    </div>
  );
}
