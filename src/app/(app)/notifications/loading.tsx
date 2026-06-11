import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="space-y-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <PageHeader
        title="Notifications"
        description="Updates on your reservations and from the club."
      />
      <ul className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="mt-2 h-3 w-3/4" />
          </li>
        ))}
      </ul>
    </div>
  );
}
