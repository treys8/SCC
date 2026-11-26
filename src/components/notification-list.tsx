"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import {
  loadMoreNotifications,
  markNotificationRead,
} from "@/app/(app)/notifications/actions";
import { cn } from "@/lib/cn";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import type { Notification } from "@/lib/database.types";

export function NotificationList({
  initial,
  initialCursor,
}: {
  initial: Notification[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [, startTransition] = useTransition();

  const loadMore = useCallback(async () => {
    if (loadingMore || cursor === null) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const page = await loadMoreNotifications(cursor);
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.items.filter((n) => !seen.has(n.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, cursor]);

  // Clear the unread state when a notification is opened: optimistic locally,
  // then persisted. The action revalidates the (app) layout so the nav bell
  // badge count refreshes after navigation, not just this page.
  function onOpen(n: Notification) {
    if (n.is_read) return;
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
    );
    startTransition(async () => {
      try {
        await markNotificationRead(n.id);
      } catch {
        // Non-fatal — the global "Mark all read" remains a fallback.
      }
    });
  }

  return (
    <>
      <ul className="rule-list">
        {items.map((n) => {
          const card = (
            <div
              className={cn(
                "relative py-5 pl-5 transition-colors",
                // Unread: a gold rule down the left edge, title in full ink.
                !n.is_read &&
                  "before:absolute before:inset-y-5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent",
                n.link && "hover:bg-surface-2/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className={cn(
                    "font-serif text-lg leading-snug",
                    n.is_read ? "text-foreground/75" : "text-foreground",
                  )}
                >
                  {n.title}
                </p>
                <time
                  dateTime={n.created_at}
                  title={formatTimestamp(n.created_at)}
                  className="shrink-0 text-caption text-muted"
                >
                  {formatRelativeTime(n.created_at)}
                </time>
              </div>
              {n.body && <p className="mt-1 text-sm text-muted">{n.body}</p>}
            </div>
          );
          return (
            <li key={n.id}>
              {n.link ? (
                <Link
                  href={n.link}
                  className="block"
                  onClick={() => onOpen(n)}
                >
                  {card}
                </Link>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>

      {cursor !== null && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="btn btn-outline"
          >
            {loadError
              ? "Couldn’t load — tap to retry"
              : loadingMore
                ? "Loading…"
                : "Load older"}
          </button>
        </div>
      )}
    </>
  );
}
