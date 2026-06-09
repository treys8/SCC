import Link from "next/link";
import { redirect } from "next/navigation";
import { DepartmentBadge } from "@/components/badges";
import { EventCard } from "@/components/event-card";
import { getProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayISO } from "@/lib/format";

export default async function DashboardPage() {
  const profile = await getProfile();
  // Members open straight into the feed; the portal dashboard is for staff.
  if (profile && !isStaff(profile.role)) redirect("/posts");
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: posts }, { data: events }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, content, department, created_at, is_pinned")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("calendar_events")
      .select("*")
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(3),
  ]);

  const firstName = profile?.full_name.split(" ")[0] ?? "Member";

  const tiles = [
    {
      href: "/posts",
      title: "Feed",
      desc: "News, photos, and updates from around the club.",
    },
    {
      href: "/reservations",
      title: "Reservations",
      desc: "Book a table and review your upcoming reservations.",
    },
    {
      href: "/calendar",
      title: "Calendar",
      desc: "See what's happening around the club.",
    },
    {
      href: "/profile",
      title: "My Profile",
      desc: "Update your contact details.",
    },
  ];

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border bg-primary px-6 py-8 text-white sm:px-10 sm:py-10">
        <p className="text-sm uppercase tracking-widest text-white/70">
          Member Portal
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          Everything happening at Starkville Country Club, in one place.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="card group flex flex-col p-5 transition-shadow hover:shadow-md"
          >
            <span className="font-serif text-lg font-semibold text-primary">
              {t.title}
            </span>
            <span className="mt-1 flex-1 text-sm text-muted">{t.desc}</span>
            <span className="mt-3 text-sm font-medium text-accent-600 transition-transform group-hover:translate-x-0.5">
              Open →
            </span>
          </Link>
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading title="Latest posts" href="/posts" />
          <div className="card divide-y divide-border">
            {posts && posts.length > 0 ? (
              posts.map((p) => (
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
              ))
            ) : (
              <p className="p-4 text-sm text-muted">No announcements yet.</p>
            )}
          </div>
        </section>

        <section>
          <SectionHeading title="Upcoming events" href="/calendar" />
          {events && events.length > 0 ? (
            <div className="space-y-4">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <p className="card p-4 text-sm text-muted">No upcoming events.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-serif text-xl font-semibold text-foreground">
        {title}
      </h2>
      <Link href={href} className="text-sm font-medium text-accent-600">
        View all →
      </Link>
    </div>
  );
}
