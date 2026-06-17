"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { loadMoreSearchPosts } from "@/app/(app)/posts/actions";
import { DEPARTMENT_LABEL } from "@/lib/constants";
import { formatTimestamp } from "@/lib/format";
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
