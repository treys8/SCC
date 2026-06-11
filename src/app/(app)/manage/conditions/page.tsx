import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { FacilityDetailsEditor } from "@/components/facility-details-editor";
import { FacilityStatusWidget } from "@/components/facility-status-widget";
import { PageHeader } from "@/components/page-header";
import { fetchFacilityStatus } from "@/lib/facility";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conditions" };

/**
 * Conditions console: the one-tap status/note editor (also surfaced on the Today
 * home for quick mobile access) plus the per-facility detail-row editor. Gated by
 * the /manage layout. Golf, driving range, pool, and tennis render automatically
 * from FACILITIES — e.g. state tennis court availability in its note/detail rows
 * ("3 of 4 courts open"), which reads through to the member Today + detail page.
 */
export default async function ManageConditionsPage() {
  const supabase = await createClient();
  const facilities = await fetchFacilityStatus(supabase);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Conditions"
        description="Set golf, driving range, pool, and tennis status, notes, and the detail rows members see."
      />
      {facilities.length > 0 ? (
        <>
          <FacilityStatusWidget initial={facilities} canManage />
          <FacilityDetailsEditor facilities={facilities} />
        </>
      ) : (
        <EmptyState
          title="No facilities configured"
          description="Golf, driving range, pool, and tennis status rows haven't been set up yet."
        />
      )}
    </div>
  );
}
