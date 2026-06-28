import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FacilityDetailView } from "@/components/facility-detail-view";
import { FACILITIES, FACILITY_LABEL } from "@/lib/constants";
import { fetchFacilityStatus } from "@/lib/facility";
import { clubTodayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { FacilityType, UpcomingGolfEvent } from "@/lib/database.types";

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

  // Golf gets a member-facing "rest of the season" list built from upcoming
  // golf events. Server-rendered (static for the page load); the conditions
  // above it stay realtime via the client view.
  let upcoming: UpcomingGolfEvent[] = [];
  if (facility === "golf") {
    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, event_date, start_time, schedule_note, registration_url")
      .eq("department", "golf")
      .gte("event_date", clubTodayISO())
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true })
      .limit(12);
    upcoming = data ?? [];
  }

  return (
    <FacilityDetailView initial={facilities} type={facility} upcoming={upcoming} />
  );
}
