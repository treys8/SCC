import Link from "next/link";
import { formatDate, formatTimeRange } from "@/lib/format";
import type { CalendarEvent } from "@/lib/database.types";

/**
 * "Next at the club" — only the single soonest upcoming event, with a date
 * block, title, and an "All events →" jump to the full calendar. Deliberately
 * lighter than the Feed/Calendar's full EventCard (no cover, register, or
 * add-to-calendar footer): a teaser, not the whole listing.
 */
export function NextEvent({ event }: { event: CalendarEvent }) {
  const meta = [
    formatDate(event.event_date),
    formatTimeRange(event.start_time, event.end_time),
    event.location,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h2 text-foreground">Next at the club</h2>
        <Link
          href="/calendar"
          className="shrink-0 text-sm font-medium text-accent-600"
        >
          All events →
        </Link>
      </div>

      <Link
        href={`/calendar/${event.id}`}
        className="card flex items-center gap-4 p-4 transition-colors hover:bg-surface-2"
      >
        <DateBlock dateStr={event.event_date} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-h2 text-foreground">{event.title}</h3>
          <p className="mt-0.5 truncate text-sm text-muted">{meta}</p>
        </div>
        <Chevron />
      </Link>
    </section>
  );
}

function DateBlock({ dateStr }: { dateStr: string }) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const month = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
  });
  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
      <span className="text-2xs font-semibold uppercase tracking-wide">
        {month}
      </span>
      <span className="text-lg font-semibold leading-none">{d}</span>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
