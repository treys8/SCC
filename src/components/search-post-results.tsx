"use client";

import { useCallback, useState } from "react";
import { loadMoreMemberSearchPosts } from "@/app/(app)/search/actions";
import { PostCard } from "@/components/post-card";
import type { FeedPost } from "@/lib/database.types";

/**
 * Member search results for posts: full feed-style `PostCard`s (read-only —
 * `canManageAny` is false), holding the keyset cursor and appending pages via
 * `loadMoreMemberSearchPosts`. The page re-keys this on a new query so the
 * loaded-pages state resets cleanly. Mirrors the staff results' load-more logic.
 */
export function SearchPostResults({
  q,
  initialPosts,
  initialCursor,
  currentUserId,
}: {
  q: string;
  initialPosts: FeedPost[];
  initialCursor: string | null;
  currentUserId: string;
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
      const page = await loadMoreMemberSearchPosts(q, cursor);
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
  }, [loading, cursor, q]);

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          canManageAny={false}
        />
      ))}

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
