"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadMorePosts,
  recordPostViews,
  refreshFeed,
} from "@/app/(app)/posts/actions";
import { EmptyState } from "@/components/empty-state";
import { PostCard } from "@/components/post-card";
import { createClient } from "@/lib/supabase/client";
import type { DepartmentType, FeedPost } from "@/lib/database.types";

export function Feed({
  initialPinned,
  initialPosts,
  initialCursor,
  depts,
  canPost,
  currentUserId,
}: {
  initialPinned: FeedPost[];
  initialPosts: FeedPost[];
  initialCursor: string | null;
  depts: DepartmentType[];
  canPost: boolean;
  currentUserId: string;
}) {
  const [pinned, setPinned] = useState(initialPinned);
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // Reach tracking (staff-facing "seen by N members"). A post counts once it has
  // actually been on screen — not merely rendered below the fold. `sentIdsRef`
  // dedupes for the life of the page so a scroll up and back doesn't re-send;
  // the RPC dedupes for good on its PK.
  const viewRootRef = useRef<HTMLDivElement>(null);
  const sentIdsRef = useRef<Set<string>>(new Set());
  const pendingViewsRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track which post ids are already on screen, so realtime only counts truly
  // new ones.
  useEffect(() => {
    knownIdsRef.current = new Set([...pinned, ...posts].map((p) => p.id));
  }, [pinned, posts]);

  const loadMore = useCallback(async () => {
    if (loadingMore || cursor === null) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const page = await loadMorePosts(depts, cursor);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      // Surface a retry affordance instead of silently stopping the scroll.
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, cursor, depts]);

  // Infinite scroll: load the next page as the sentinel nears the viewport.
  // While an error is showing, leave the observer disarmed so it doesn't retry
  // in a tight loop behind the error UI — the user re-arms it via the retry tap.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || loadError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, loadError]);

  // Batch the ids seen so far into one call, rather than a request per card.
  const flushViews = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const ids = [...pendingViewsRef.current];
    if (ids.length === 0) return;
    pendingViewsRef.current.clear();
    // Fire and forget: recordPostViews swallows its own errors, and a failed
    // count must never interrupt reading.
    void recordPostViews(ids);
  }, []);

  // Watch the cards themselves: a card only counts once a real part of it has
  // been on screen, so one clipped at the viewport edge while scrolling past
  // isn't "seen". Re-runs as pages load so newly-mounted cards get observed.
  //
  // "Half the card" alone can't be the test — a post with a tall photo can be
  // taller than the phone, so its ratio never reaches 0.5 at any scroll
  // position and it would never count no matter how carefully it was read. So
  // either half the card is visible, or it's filling half the screen. The
  // several thresholds exist to get callbacks while such a card scrolls past;
  // with a single one, nothing would fire between crossings.
  useEffect(() => {
    const root = viewRootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const seen =
            entry.intersectionRatio >= 0.5 ||
            entry.intersectionRect.height >= window.innerHeight * 0.5;
          if (!seen) continue;
          const id = (entry.target as HTMLElement).dataset.postId;
          if (!id || sentIdsRef.current.has(id)) continue;
          sentIdsRef.current.add(id);
          pendingViewsRef.current.add(id);
          observer.unobserve(entry.target); // counted once; stop watching it
        }
        if (pendingViewsRef.current.size > 0 && !flushTimerRef.current) {
          flushTimerRef.current = setTimeout(flushViews, 2000);
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5] },
    );

    for (const el of root.querySelectorAll<HTMLElement>("[data-post-id]")) {
      if (!sentIdsRef.current.has(el.dataset.postId ?? "")) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [pinned, posts, flushViews]);

  // Send the pending batch early rather than waiting out the debounce: on the
  // cleanup path (navigating within the app) that's what saves it, and on
  // pagehide it at least gets the request away before a bfcache freeze.
  //
  // It is NOT a guarantee against closing the tab: recordPostViews is a Server
  // Action, i.e. a plain fetch, and browsers cancel in-flight fetches on a real
  // unload. Reading a post and closing within the 2s window therefore still
  // loses that view. Accepted — reach is a trend, not an audit — and the
  // alternative is a sendBeacon route handler outside the action layer.
  useEffect(() => {
    const onLeave = () => flushViews();
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      flushViews();
    };
  }, [flushViews]);

  // Realtime: count new posts from other members matching the current filter.
  // postgres_changes is RLS-gated by the socket's JWT — without it the socket is
  // `anon`, and since posts are authenticated-only it would receive nothing. So
  // set the user's token before subscribing.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel("feed-posts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "posts" },
          (payload) => {
            const row = payload.new as {
              id: string;
              author_id: string;
              department: DepartmentType;
            };
            if (row.author_id === currentUserId) return;
            if (depts.length && !depts.includes(row.department)) return;
            if (knownIdsRef.current.has(row.id)) return;
            knownIdsRef.current.add(row.id);
            setNewCount((c) => c + 1);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [depts, currentUserId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      const { pinned: freshPinned, page } = await refreshFeed(depts);
      setPinned(freshPinned);
      setPosts(page.posts);
      setCursor(page.nextCursor);
      setNewCount(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // Keep newCount so the pill stays — tapping it retries the refresh.
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  }, [depts]);

  const isEmpty = pinned.length === 0 && posts.length === 0;

  return (
    <>
      {newCount > 0 && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="fixed left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-primary-700 disabled:opacity-60"
        >
          ↑ {newCount} new {newCount === 1 ? "post" : "posts"}
        </button>
      )}

      {refreshError && (
        <p
          role="alert"
          className="fixed left-1/2 top-32 z-30 -translate-x-1/2 rounded-full bg-surface px-3 py-1 text-xs text-danger shadow"
        >
          Couldn&rsquo;t refresh — tap the pill to try again.
        </p>
      )}

      {isEmpty ? (
        <EmptyState
          icon={<MegaphoneIcon />}
          title="Nothing here yet"
          description={
            canPost
              ? "Post the first update for members."
              : depts.length
                ? "No posts in these categories yet."
                : "Check back soon for news from the club."
          }
        />
      ) : (
        <div ref={viewRootRef} className="space-y-4">
          {pinned.map((post) => (
            <div key={post.id} data-post-id={post.id}>
              <PostCard
                post={post}
                currentUserId={currentUserId}
                canManageAny={canPost}
              />
            </div>
          ))}
          {posts.map((post) => (
            <div key={post.id} data-post-id={post.id}>
              <PostCard
                post={post}
                currentUserId={currentUserId}
                canManageAny={canPost}
              />
            </div>
          ))}

          {cursor !== null && (
            <div ref={sentinelRef} className="py-2">
              {loadError ? (
                <button
                  type="button"
                  onClick={loadMore}
                  className="mx-auto block rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-primary hover:text-foreground"
                >
                  Couldn&rsquo;t load more — tap to retry
                </button>
              ) : (
                <PostSkeleton />
              )}
            </div>
          )}
          {cursor === null && posts.length > 0 && (
            <p className="py-4 text-center text-sm text-muted">
              You&rsquo;re all caught up.
            </p>
          )}
        </div>
      )}

      {canPost && (
        <Link
          href="/posts/new"
          aria-label="New post"
          className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl leading-none text-white shadow-lg transition hover:bg-primary-700 active:scale-95 md:hidden"
        >
          +
        </Link>
      )}
    </>
  );
}

function MegaphoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="m3 11 14-7v16l-14-7Z" />
      <path d="M17 8a3 3 0 0 1 0 6" />
      <path d="M6 12v5a2 2 0 0 0 2 2h1" />
    </svg>
  );
}

function PostSkeleton() {
  return (
    <div className="card animate-pulse p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-border" />
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-border" />
          <div className="h-3 w-20 rounded bg-border" />
        </div>
      </div>
      <div className="mt-4 h-4 w-3/4 rounded bg-border" />
      <div className="mt-2 h-40 w-full rounded-lg bg-border" />
    </div>
  );
}
