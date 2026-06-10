import Link from "next/link";
import { DepartmentBadge } from "@/components/badges";
import { EventCard } from "@/components/event-card";
import { FacilityStatusWidget } from "@/components/facility-status-widget";
import { NextReservationCard } from "@/components/today/next-reservation-card";
import { WeatherCard } from "@/components/today/weather-card";
import { getProfile, isStaff } from "@/lib/auth";
import { fetchFacilityStatus } from "@/lib/facility";
import { fetchLatestPosts } from "@/lib/feed";
import { formatDate, todayISO } from "@/lib/format";
import { fetchNextReservation } from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import { fetchWeather } from "@/lib/weather";

/**
 * "Today at the Club" — the member home. A glanceable answer to "what's
 * happening right now / what do I need to do," not a second feed: fixed
 * sections in priority order, each collapsing when it has nothing to show.
 * Staff see the same page, with the facility widget's inline controls.
 */
export default async function TodayPage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const today = todayISO();

  const [facilities, reservation, upcoming, posts, weather] = await Promise.all([
    fetchFacilityStatus(supabase),
    profile
      ? fetchNextReservation(supabase, profile.id)
      : Promise.resolve(null),
    supabase
      .from("calendar_events")
      .select("*")
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(3),
    fetchLatestPosts(supabase, 3),
    fetchWeather(),
  ]);

  const upcomingEvents = upcoming.data ?? [];
  const todaysEvents = upcomingEvents.filter((e) => e.event_date === today);
  // Show what's on *today*; if nothing is, fall back to the next few so the
  // section isn't usually empty (the Calendar tab holds the full schedule).
  const events = todaysEvents.length > 0 ? todaysEvents : upcomingEvents;

  const firstName = profile?.full_name.split(" ")[0] ?? "Member";
  const canManage = profile ? isStaff(profile.role) : false;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm uppercase tracking-widest text-muted">
          Today at the Club
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">
          Welcome back, {firstName}.
        </h1>
      </header>

      {facilities.length > 0 && (
        <FacilityStatusWidget initial={facilities} canManage={canManage} />
      )}

      {reservation && (
        <section className="space-y-3">
          <SectionHeading title="Your next reservation" href="/reservations" />
          <NextReservationCard reservation={reservation} />
        </section>
      )}

      {events.length > 0 && (
        <section className="space-y-3">
          <SectionHeading
            title={
              todaysEvents.length > 0 ? "Today on the calendar" : "Upcoming events"
            }
            href="/calendar"
          />
          <div className="space-y-4">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {weather && (
        <section className="space-y-3">
          <SectionHeading title="Weather" />
          <WeatherCard weather={weather} />
        </section>
      )}

      {posts.length > 0 && (
        <section className="space-y-3">
          <SectionHeading title="Latest posts" href="/posts" />
          <div className="card divide-y divide-border">
            {posts.map((p) => (
              <Link
                key={p.id}
                href="/posts"
                className="flex items-start justify-between gap-3 p-4 hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {p.title || p.content || "Update"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDate(p.created_at.slice(0, 10))}
                  </p>
                </div>
                <DepartmentBadge department={p.department} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeading({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-serif text-xl font-semibold text-foreground">
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-sm font-medium text-accent-600">
          View all →
        </Link>
      )}
    </div>
  );
}
