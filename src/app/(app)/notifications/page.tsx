import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { MarkAllReadButton } from "@/components/mark-all-read-button";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/cn";
import { requireProfile } from "@/lib/auth";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const notifications = data ?? [];
  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Updates on your reservations and from the club."
      />

      {hasUnread && (
        <div className="flex justify-end">
          <MarkAllReadButton />
        </div>
      )}

      {notifications.length === 0 ? (
        <EmptyState
          icon={<BellIcon />}
          title="No notifications"
          description="You're all caught up."
        />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const card = (
              <div
                className={cn(
                  "card p-4 transition-colors",
                  !n.is_read && "border-primary/40 bg-primary/5",
                  n.link && "hover:border-primary",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-foreground">{n.title}</p>
                  <time
                    dateTime={n.created_at}
                    title={formatTimestamp(n.created_at)}
                    className="shrink-0 text-caption text-muted"
                  >
                    {formatRelativeTime(n.created_at)}
                  </time>
                </div>
                {n.body && (
                  <p className="mt-1 text-sm text-muted">{n.body}</p>
                )}
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="block">
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BellIcon() {
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
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}
