import { PageHeader } from "@/components/page-header";
import { SkeletonRows } from "@/components/skeleton";

export default function ReservationsLoading() {
  return (
    <div className="space-y-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <PageHeader
        title="Reservations"
        description="Request a table and track your reservations."
      />
      <SkeletonRows rows={4} />
    </div>
  );
}
