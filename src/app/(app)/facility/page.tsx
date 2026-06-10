import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { FacilityStatusWidget } from "@/components/facility-status-widget";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { fetchFacilityStatus } from "@/lib/facility";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Facility" };

/**
 * Staff-only operations surface for facility status. The Today strip and the
 * Feed card both render the same data read-only; this is the one place Golf and
 * Pool status, notes, and weather holds are *set*. Gated to staff/admin the way
 * /members is gated to admins — members who reach it are redirected home.
 */
export default async function FacilityPage() {
  await requireRole("staff", "admin");

  const supabase = await createClient();
  const facilities = await fetchFacilityStatus(supabase);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facility status"
        description="Set the course and pool status members see across the club."
      />
      {facilities.length > 0 ? (
        <FacilityStatusWidget initial={facilities} canManage />
      ) : (
        <EmptyState
          title="No facilities configured"
          description="Golf and pool status rows haven't been set up yet."
        />
      )}
    </div>
  );
}
