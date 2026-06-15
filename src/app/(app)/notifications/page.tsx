import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { MarkAllReadButton } from "@/components/mark-all-read-button";
import { NotificationList } from "@/components/notification-list";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { fetchNotificationsPage } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { items, nextCursor } = await fetchNotificationsPage(
    supabase,
    profile.id,
  );
  const hasUnread = items.some((n) => !n.is_read);

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

      {items.length === 0 ? (
        <EmptyState
          icon={<BellIcon />}
          title="No notifications"
          description="You're all caught up."
        />
      ) : (
        <NotificationList initial={items} initialCursor={nextCursor} />
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
