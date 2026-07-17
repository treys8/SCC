"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getPostViewCounts,
  loadMoreSearchPosts,
} from "@/app/(app)/posts/actions";
import { DEPARTMENT_LABEL } from "@/lib/constants";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { FeedPost } from "@/lib/database.types";
import type { PostSearchFilters } from "@/lib/feed";

/**
 * Compact, scannable result rows for the staff post search. Each row links to
 * the existing edit flow (`/posts/[id]/edit`, now unlocked for staff). Holds the
 * loaded posts + keyset cursor and appends pages via the load-more action — the
 * server page re-keys this component on filter change, so state resets cleanly.
 */
export function ManagePostsResults({
  initialPosts,
  initialCursor,
  filters,
}: {
  initialPosts: FeedPost[];
  initialCursor: string | null;
  filters: PostSearchFilters;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});

  // Reach for whatever's on screen, refetched as pages append. Done here rather
  // than server-side on the first page so loaded-more rows get counts too, from
  // one code path. Best-effort: a missing count just hides the line.
  useEffect(() => {
    let cancelled = false;
    const ids = posts.map((p) => p.id);
    if (ids.length === 0) return;
    getPostViewCounts(ids)
      .then((counts) => {
        if (!cancelled) setViewCounts((prev) => ({ ...prev, ...counts }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [posts]);

  const loadMore = useCallback(async () => {
    if (loading || cursor === null) return;
    setLoading(true);
    setError(false);
    try {
      const page = await loadMoreSearchPosts(filters, cursor);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, cursor, filters]);

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/posts/${post.id}/edit`}
              className="group flex items-start justify-between gap-4 bg-surface p-4 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
                    {DEPARTMENT_LABEL[post.department]}
                  </span>
                  {post.status !== "published" && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-caption font-medium",
                        post.status === "draft"
                          ? "bg-surface-2 text-muted"
                          : "bg-accent/10 text-accent-600",
                      )}
                    >
                      {post.status === "draft"
                        ? "Draft"
                        : post.publish_at
                          ? `Scheduled · ${formatTimestamp(post.publish_at)}`
                          : "Scheduled"}
                    </span>
                  )}
                  {post.is_pinned && (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-caption font-medium text-warning-strong">
                      Pinned
                    </span>
                  )}
                </div>
                <p className="truncate font-medium text-foreground">
                  {post.title || firstLine(post.content) || "Untitled post"}
                </p>
                {post.title && post.content && (
                  <p className="truncate text-sm text-muted">{post.content}</p>
                )}
                <p className="text-caption text-muted">
                  {post.author?.full_name ?? "Club"}
                  {post.author?.title ? ` · ${post.author.title}` : ""} ·{" "}
                  {formatTimestamp(post.created_at)}
                  {/* Reach, for published posts only — a draft nobody can see
                      yet showing "Seen by 0" reads as a failure, not a fact. */}
                  {post.status === "published" && (
                    <> · {seenLabel(viewCounts[post.id] ?? 0)}</>
                  )}
                </p>
              </div>
              <span
                aria-hidden
                className="mt-0.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {cursor !== null && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mx-auto block rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-primary hover:text-foreground disabled:opacity-60"
        >
          {error
            ? "Couldn’t load more — tap to retry"
            : loading
              ? "Loading…"
              : "Load more"}
        </button>
      )}
    </div>
  );
}

/** First non-empty line of the body, for posts with no title. */
function firstLine(content: string): string {
  return content.split("\n").find((l) => l.trim()) ?? "";
}

/** "Seen by 62 members" — the reach line. Zero says so plainly rather than
 * hiding, so staff can tell "nobody's read it" from "we're not counting". */
function seenLabel(count: number): string {
  if (count === 0) return "Not seen yet";
  return `Seen by ${count} ${count === 1 ? "member" : "members"}`;
}
