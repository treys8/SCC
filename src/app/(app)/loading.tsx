import { Skeleton, SkeletonCard } from "@/components/skeleton";

/** Fallback for the "Today at the Club" home: hero, conditions cards, events. */
export default function TodayLoading() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <span role="status" className="sr-only">
        Loading…
      </span>

      {/* Concierge hero */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      {/* Course & Pool conditions */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        ))}
      </div>

      {/* Today's events */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <SkeletonCard />
      </div>
    </div>
  );
}
