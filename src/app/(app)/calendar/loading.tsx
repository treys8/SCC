import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/skeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <PageHeader
        title="Calendar"
        description="Events and functions around the club."
      />

      {/* Department filter chips */}
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Month grid */}
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
