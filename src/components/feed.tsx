"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadMorePosts,
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
  const [refreshing, setRefreshing] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // Track which post ids are already on screen, so realtime only counts truly
  // new ones.
  useEffect(() => {
    knownIdsRef.current = new Set([...pinned, ...posts].map((p) => p.id));
  }, [pinned, posts]);

  const loadMore = useCallback(async () => {
    if (loadingMore || cursor === null) return;
    setLoadingMore(true);
    try {
      const page = await loadMorePosts(depts, cursor);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, cursor, depts]);

  // Infinite scroll: load the next page as the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

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
    try {
      const { pinned: freshPinned, page } = await refreshFeed(depts);
      setPinned(freshPinned);
      setPosts(page.posts);
      setCursor(page.nextCursor);
      setNewCount(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        <div className="space-y-4">
          {pinned.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
            />
          ))}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
            />
          ))}

          {cursor !== null && (
            <div ref={sentinelRef} className="py-2">
              <PostSkeleton />
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
