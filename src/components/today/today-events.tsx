import Link from "next/link";
import type { CalendarEvent } from "@/lib/database.types";

/**
 * "At the club today" — the day's calendar events as a ruled list: the start
 * time set in serif on the left, then title and where. Real data
 * (calendar_events for today, soonest first), each row linking to its event.
 * When nothing's scheduled it says so in one quiet italic line with a way into
 * the week, rather than an empty box.
 */
export function TodayEvents({ events }: { events: CalendarEvent[] }) {
  return (
    <section>
      <div className="section-rule">
        <h2 className="text-section text-foreground">At the club today</h2>
        <Link
          href="/calendar"
          className="shrink-0 text-sm tracking-[0.03em] text-gold-ink hover:text-foreground"
        >
          Full calendar →
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 py-2">
          <p className="font-serif text-xl text-muted italic sm:text-2xl">
            A quiet day on the calendar.
          </p>
          <Link href="/calendar" className="btn btn-outline">
            View the week
          </Link>
        </div>
      ) : (
        <ul className="rule-list">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/calendar/${event.id}`}
                className="group flex items-baseline gap-5 py-5 sm:gap-8"
              >
                <EventTime time={event.start_time} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-xl leading-snug text-foreground transition-colors group-hover:text-primary sm:text-2xl">
                    {event.title}
                  </h3>
                  {event.location && (
                    <p className="mt-1 truncate text-sm text-muted">
                      {event.location}
                    </p>
                  )}
                </div>
                <span
                  aria-hidden
                  className="self-center text-gold-ink transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "9:00" in serif over a small-caps "AM", in a fixed-width column. */
function EventTime({ time }: { time: string }) {
  const [h, min] = time.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const label = `${hour12}:${String(min).padStart(2, "0")}`;

  return (
    <div className="w-16 shrink-0 sm:w-20">
      <span className="block font-serif text-2xl leading-none text-primary sm:text-[1.7rem]">
        {label}
      </span>
      <span className="mt-1.5 block text-[0.65rem] font-semibold tracking-[0.18em] text-muted">
        {period}
      </span>
    </div>
  );
}
