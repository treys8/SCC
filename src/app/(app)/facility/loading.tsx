import { PageHeader } from "@/components/page-header";
import { SkeletonCard } from "@/components/skeleton";

export default function FacilityLoading() {
  return (
    <div className="space-y-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <PageHeader
        title="Facility status"
        description="Set the course and pool status members see across the club."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
