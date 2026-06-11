import { cn } from "@/lib/cn";

/**
 * Loading-state placeholders. A single `<Skeleton>` is a shimmering block you
 * compose to mock any layout; the named composites below cover the common
 * shapes (text lines, content cards, list/table rows). The pulse is neutralised
 * automatically for users with "reduce motion" enabled (see globals.css).
 *
 * All blocks are `aria-hidden` — the route's Suspense fallback is what signals
 * "loading" to assistive tech, so the decorative shapes stay out of the a11y
 * tree. Pair with an sr-only "Loading…" label at the top of each loading.tsx.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded bg-border", className)}
    />
  );
}

/** N text-height lines; the last is shortened like the tail of a paragraph. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** A content-card placeholder: avatar + meta, a heading, and a body block.
    Mirrors the feed's PostSkeleton so list pages read consistently. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("card p-5", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="mt-4 h-4 w-3/4" />
      <Skeleton className="mt-2 h-24 w-full rounded-lg" />
    </div>
  );
}

/** Stacked rows for table/list loading (avatar + two lines + trailing control). */
export function SkeletonRows({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
