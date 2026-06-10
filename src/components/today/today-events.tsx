import Link from "next/link";
import type { CalendarEvent } from "@/lib/database.types";

/**
 * "Today at the club" — the day's calendar events as a list, each a time chip
 * plus title and where. Real data (calendar_events for today, soonest first),
 * with each row linking into the full calendar. Shows a gentle empty state when
 * nothing's scheduled, so the heading never sits over a blank space.
 */
export function TodayEvents({ events }: { events: CalendarEvent[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h2 text-foreground">Today at the club</h2>
        <Link
          href="/calendar"
          className="shrink-0 text-sm font-medium text-accent-600"
        >
          Full calendar →
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="card p-5 text-sm text-muted">
          Nothing on the calendar today.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/calendar/${event.id}`}
                className="card flex items-center gap-4 p-4 transition-colors hover:bg-surface-2"
              >
                <TimeChip time={event.start_time} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-h2 text-foreground">
                    {event.title}
                  </h3>
                  {event.location && (
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {event.location}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A two-line time chip: "9:00" over "AM". */
function TimeChip({ time }: { time: string }) {
  const [h, min] = time.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const label = `${hour12}:${String(min).padStart(2, "0")}`;

  return (
    <div className="flex h-14 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
      <span className="text-sm font-semibold leading-none">{label}</span>
      <span className="mt-1 text-2xs uppercase tracking-wide text-muted">
        {period}
      </span>
    </div>
  );
}
