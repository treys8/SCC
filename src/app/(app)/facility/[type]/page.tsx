import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FacilityDetailView } from "@/components/facility-detail-view";
import { FACILITIES, FACILITY_LABEL } from "@/lib/constants";
import { fetchFacilityStatus } from "@/lib/facility";
import { createClient } from "@/lib/supabase/server";
import type { FacilityType } from "@/lib/database.types";

/**
 * Member-facing facility detail — the read-only counterpart to the staff
 * /manage/conditions editor. Reached by tapping a row in the Today conditions
 * card. `[type]` is validated against the FACILITIES list; anything else 404s.
 * The view subscribes to realtime so staff changes land without a reload.
 */

const VALID = new Set<string>(FACILITIES);

function parseType(type: string): FacilityType | null {
  return VALID.has(type) ? (type as FacilityType) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await params;
  const facility = parseType(type);
  return { title: facility ? FACILITY_LABEL[facility] : "Conditions" };
}

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const facility = parseType(type);
  if (!facility) notFound();

  const supabase = await createClient();
  const facilities = await fetchFacilityStatus(supabase);
  // The row is seeded by migration; if it's somehow absent, treat as not found
  // rather than render an empty shell.
  if (!facilities.some((f) => f.facility === facility)) notFound();

  return <FacilityDetailView initial={facilities} type={facility} />;
}
