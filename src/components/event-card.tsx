import { DepartmentBadge } from "@/components/badges";
import { EventActions } from "@/components/event-actions";
import { formatDate, formatTimeRange } from "@/lib/format";
import type { CalendarEvent } from "@/lib/database.types";

export function EventCard({
  event,
  canManage,
}: {
  event: CalendarEvent;
  canManage: boolean;
}) {
  return (
    <article className="card flex gap-4 p-5">
      <DateChip dateStr={event.event_date} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-semibold text-foreground">
            {event.title}
          </h3>
          {canManage && <EventActions id={event.id} />}
        </div>

        <p className="mt-1 text-sm text-muted">
          {formatTimeRange(event.start_time, event.end_time)}
          {event.location ? ` · ${event.location}` : ""}
        </p>

        {event.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
            {event.description}
          </p>
        )}

        {event.department && (
          <div className="mt-3">
            <DepartmentBadge department={event.department} />
          </div>
        )}
      </div>
    </article>
  );
}

function DateChip({ dateStr }: { dateStr: string }) {
  const [, m, d] = dateStr.split("-").map(Number);
  const month = new Date(2000, m - 1, 1)
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary text-white">
      <span className="text-[10px] font-semibold tracking-wide">{month}</span>
      <span className="font-serif text-xl font-bold leading-none">{d}</span>
    </div>
  );
}
