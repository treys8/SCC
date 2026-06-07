import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { PageHeader } from "@/components/page-header";
import { isStaff, requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  const all = data ?? [];
  const today = todayISO();
  const upcoming = all.filter((e) => e.event_date >= today);
  const past = all.filter((e) => e.event_date < today).reverse();
  const canManage = isStaff(profile.role);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Calendar"
        description="Upcoming events at the club."
        action={
          canManage ? (
            <Link href="/calendar/new" className="btn btn-primary">
              New event
            </Link>
          ) : undefined
        }
      />

      <section className="space-y-4">
        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming events"
            description={
              canManage
                ? "Add the next event on the club calendar."
                : "Check back soon for upcoming events."
            }
          />
        ) : (
          upcoming.map((e) => (
            <EventCard key={e.id} event={e} canManage={canManage} />
          ))
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-xl font-semibold text-foreground">
            Past events
          </h2>
          <div className="space-y-4 opacity-75">
            {past.slice(0, 10).map((e) => (
              <EventCard key={e.id} event={e} canManage={canManage} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
