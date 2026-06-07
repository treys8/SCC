import type { Metadata } from "next";
import Link from "next/link";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/page-header";
import { isStaff, requireProfile } from "@/lib/auth";
import { gridRange, parseMonth } from "@/lib/calendar";
import { DEPARTMENTS } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentType } from "@/lib/database.types";

export const metadata: Metadata = { title: "Calendar" };

const DEPT_VALUES = new Set<string>(DEPARTMENTS.map((d) => d.value));

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; dept?: string }>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;

  const { key: month } = parseMonth(sp.m);
  const dept =
    sp.dept && DEPT_VALUES.has(sp.dept) ? (sp.dept as DepartmentType) : "all";
  const { start, end } = gridRange(month);

  const supabase = await createClient();
  let query = supabase
    .from("calendar_events")
    .select("*")
    .gte("event_date", start)
    .lte("event_date", end)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (dept !== "all") query = query.eq("department", dept);
  const { data } = await query;

  const canManage = isStaff(profile.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Events and functions around the club."
        action={
          canManage ? (
            <Link href="/calendar/new" className="btn btn-primary">
              New event
            </Link>
          ) : undefined
        }
      />

      <CalendarView
        key={`${month}-${dept}`}
        events={data ?? []}
        month={month}
        dept={dept}
        todayIso={todayISO()}
      />
    </div>
  );
}
