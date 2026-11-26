import { Skeleton, SkeletonCard } from "@/components/skeleton";

/**
 * Generic fallback for the app segment. Deliberately NOT a replica of Today:
 * routes without their own loading.tsx (dining, pool, documents, contact,
 * search, directory, detail pages) fall back here, so it mocks the shape every
 * page shares — the green title band, then a couple of content blocks.
 */
export default function AppLoading() {
  return (
    <div>
      <span role="status" className="sr-only">
        Loading…
      </span>

      {/* Title band (same breakout as PageHeader). */}
      <div className="mx-[calc(50%-50vw)] mb-8 bg-green-deep px-[calc(50vw-50%)] pt-7 pb-9 sm:mb-10 sm:pt-10 sm:pb-12">
        <div aria-hidden className="h-3 w-28 animate-pulse rounded bg-cream/15" />
        <div aria-hidden className="mt-4 h-9 w-64 max-w-full animate-pulse rounded bg-cream/15" />
      </div>

      <div className="space-y-6">
        <Skeleton className="h-4 w-48" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
