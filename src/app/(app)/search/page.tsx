import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DocumentLink } from "@/components/document-link";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { MemberSearch, type SearchType } from "@/components/member-search";
import { PageHeader } from "@/components/page-header";
import { SearchPostResults } from "@/components/search-post-results";
import { requireProfile } from "@/lib/auth";
import { sanitizeSearch, searchPosts } from "@/lib/feed";
import { SEARCH_GROUP_LIMIT, searchDocuments, searchEvents } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Search" };

const VALID_TYPES = new Set<string>(["all", "posts", "docs", "events"]);
function parseType(raw?: string): SearchType {
  return (raw && VALID_TYPES.has(raw) ? raw : "all") as SearchType;
}

/**
 * Member-facing unified search across the feed, document library, and calendar
 * events. Keyword + type scope live in the URL (`?q=&type=`). All three groups
 * are always queried so the type tabs can show per-group counts; the `type`
 * scope only controls which group is displayed. Posts paginate (keyset);
 * documents and events are capped at SEARCH_GROUP_LIMIT.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const rawQ = (sp.q ?? "").trim();
  const term = sanitizeSearch(rawQ);
  const type = parseType(sp.type);
  const hasQuery = term.length > 0;

  const supabase = await createClient();
  const [postPage, docs, events] = hasQuery
    ? await Promise.all([
        searchPosts(supabase, {
          q: term,
          depts: [],
          from: null,
          to: null,
          before: null,
        }),
        searchDocuments(supabase, term),
        searchEvents(supabase, term),
      ])
    : [{ posts: [], nextCursor: null }, [], []];

  const postsN = postPage.posts.length;
  const morePosts = postPage.nextCursor !== null;
  const allN = postsN + docs.length + events.length;
  // "+" marks an undercount: posts only loaded its first keyset page.
  const counts = hasQuery
    ? {
        all: `${allN}${morePosts ? "+" : ""}`,
        posts: `${postsN}${morePosts ? "+" : ""}`,
        docs: `${docs.length}`,
        events: `${events.length}`,
      }
    : null;

  const visibleCount =
    type === "all"
      ? allN
      : type === "posts"
        ? postsN
        : type === "docs"
          ? docs.length
          : events.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description="Find announcements, documents, and events."
      />
      <MemberSearch q={rawQ} type={type} counts={counts} />

      {!hasQuery ? (
        <EmptyState
          title="Search the club"
          description="Find a past announcement, a menu or newsletter, or an upcoming event."
          icon={<SearchGlyph />}
        />
      ) : visibleCount === 0 ? (
        <EmptyState
          title="No results"
          description={
            type === "all"
              ? "Try a different word or spelling."
              : "Nothing in this category — try the All tab."
          }
          icon={<SearchGlyph />}
        />
      ) : (
        <div className="space-y-8">
          {(type === "all" || type === "posts") && postsN > 0 && (
            <Section title="Feed" count={postsN} more={morePosts}>
              <SearchPostResults
                // Re-key on a new query so loaded-pages state resets cleanly.
                key={term}
                q={term}
                initialPosts={postPage.posts}
                initialCursor={postPage.nextCursor}
                currentUserId={profile.id}
              />
            </Section>
          )}

          {(type === "all" || type === "docs") && docs.length > 0 && (
            <Section
              title="Documents"
              count={docs.length}
              capped={docs.length === SEARCH_GROUP_LIMIT}
            >
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <DocumentLink key={doc.id} doc={doc} />
                ))}
              </ul>
            </Section>
          )}

          {(type === "all" || type === "events") && events.length > 0 && (
            <Section
              title="Events"
              count={events.length}
              capped={events.length === SEARCH_GROUP_LIMIT}
            >
              <div className="space-y-4">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  more = false,
  capped = false,
  children,
}: {
  title: string;
  count: number;
  more?: boolean;
  capped?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-2 text-h2 text-foreground">
        {title}
        <span className="text-sm font-normal text-muted">
          {count}
          {more ? "+" : ""}
        </span>
      </h2>
      {children}
      {capped && (
        <p className="text-caption text-muted">
          Showing the first {SEARCH_GROUP_LIMIT}. Narrow your search to see more.
        </p>
      )}
    </section>
  );
}

function SearchGlyph() {
  return (
    <svg
      aria-hidden
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
