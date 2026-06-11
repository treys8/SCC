import Link from "next/link";
import { cn } from "@/lib/cn";

/** Top-bar bell linking to the notification center, with an unread-count badge.
 *
 *  Two states:
 *    • empty     — muted outline bell that warms to foreground on hover.
 *    • has items — bell turns brand green with a soft fill, and the red count
 *                  badge pops in once (the pop replays only when the badge
 *                  re-mounts, i.e. when the count rises from zero).
 *
 *  The h-11/w-11 (→ sm:h-9) sizing keeps a >=44px tap target on phones. */
export function NotificationBell({ count }: { count: number }) {
  const hasUnread = count > 0;
  return (
    <Link
      href="/notifications"
      aria-label={hasUnread ? `Notifications, ${count} unread` : "Notifications"}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-md transition-colors sm:h-9 sm:w-9",
        hasUnread
          ? "text-primary hover:bg-primary/10"
          : "text-muted hover:bg-background hover:text-foreground",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path
          className={cn("transition-colors", hasUnread && "fill-primary/10")}
          d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"
        />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
      {hasUnread && (
        <span className="animate-badge-pop absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-2xs font-semibold leading-none text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
