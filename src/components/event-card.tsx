import Image from "next/image";
import Link from "next/link";
import { DepartmentBadge } from "@/components/badges";
import { AddToCalendar } from "@/components/calendar/add-to-calendar";
import { DateChip } from "@/components/calendar/date-chip";
import { formatDate, formatTimeRange } from "@/lib/format";
import type { CalendarEvent } from "@/lib/database.types";

const COVER_SIZES = "(max-width: 768px) 100vw, 640px";

/**
 * An event's 2:1 cover image. Shared so the card and the detail-page hero render
 * covers identically. `eager` hints the optimizer for above-the-fold heroes.
 */
export function EventCover({
  url,
  eager = false,
}: {
  url: string;
  eager?: boolean;
}) {
  return (
    <div className="relative aspect-[2/1] bg-surface-2">
      <Image
        src={url}
        alt=""
        fill
        sizes={COVER_SIZES}
        className="object-cover"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
      />
    </div>
  );
}

/**
 * Shared, actionable rendering of a calendar event: cover photo, when/where,
 * Register (deep-link out to GolfGenius etc.) and Add to calendar. Used on the
 * dashboard today; built to be reused by the "Today at the Club" page and
 * typed feed posts. The whole body links to the event detail page; the footer
 * actions sit outside that link so they stay independently tappable.
 */
export function EventCard({ event }: { event: CalendarEvent }) {
  const href = `/calendar/${event.id}`;

  return (
    <article className="card overflow-hidden">
      <Link href={href} className="block transition-colors hover:bg-surface-2">
        {event.cover_image_url && <EventCover url={event.cover_image_url} />}

        <div className="flex gap-4 p-4 sm:p-5">
          <DateChip dateStr={event.event_date} />
          <div className="min-w-0 flex-1">
            <h3 className="text-h2 text-foreground">{event.title}</h3>
            <p className="mt-1 text-sm text-muted">
              {formatDate(event.event_date)} ·{" "}
              {formatTimeRange(event.start_time, event.end_time)}
            </p>
            {(event.location || event.fee) && (
              <p className="mt-0.5 text-sm text-muted">
                {[event.location, event.fee].filter(Boolean).join(" · ")}
              </p>
            )}
            {event.department && (
              <div className="mt-2">
                <DepartmentBadge department={event.department} />
              </div>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
        <AddToCalendar event={event} />
        {event.registration_url && (
          <RegisterLink href={event.registration_url} />
        )}
      </div>
    </article>
  );
}

/** Primary "Register" action that hands off to the event's external page. */
export function RegisterLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-primary btn-sm"
    >
      Register <ExternalIcon />
    </a>
  );
}

function ExternalIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}
