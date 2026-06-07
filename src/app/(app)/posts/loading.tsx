import { PageHeader } from "@/components/page-header";

/** Skeleton shown while the feed's first page streams in. */
export default function FeedLoading() {
  return (
    <div className="space-y-4">
      <PageHeader title="Feed" description="Updates from around the club." />
      <div className="h-9" />
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card animate-pulse p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-border" />
              <div className="space-y-2">
                <div className="h-3 w-32 rounded bg-border" />
                <div className="h-3 w-20 rounded bg-border" />
              </div>
            </div>
            <div className="mt-4 h-4 w-3/4 rounded bg-border" />
            <div className="mt-2 h-44 w-full rounded-lg bg-border" />
          </div>
        ))}
      </div>
    </div>
  );
}
