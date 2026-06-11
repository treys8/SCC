import { PageHeader } from "@/components/page-header";
import { SkeletonRows } from "@/components/skeleton";

export default function MembersLoading() {
  return (
    <div className="space-y-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <PageHeader
        title="Members"
        description="Invite new members and manage roles."
      />
      <SkeletonRows rows={6} />
    </div>
  );
}
