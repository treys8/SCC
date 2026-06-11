"use client";

import { ConditionsGrid } from "@/components/conditions-grid";
import { useLiveFacilityStatus } from "@/lib/use-live-facility-status";
import type { FacilityStatus } from "@/lib/database.types";

/**
 * The Feed's "Course & Pool" card. Renders the exact same ConditionsGrid the
 * Today page uses, but seeds from server data and then updates live as staff
 * change a status — so the Feed card never goes stale between navigations.
 */
export function LiveConditionsGrid({
  facilities,
  canManage = false,
}: {
  facilities: FacilityStatus[];
  canManage?: boolean;
}) {
  const [rows] = useLiveFacilityStatus(facilities);
  return <ConditionsGrid facilities={rows} canManage={canManage} />;
}
