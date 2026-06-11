"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DepartmentBadge } from "@/components/badges";
import { DateChip } from "@/components/calendar/date-chip";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/cn";
import { DEPARTMENTS } from "@/lib/constants";
import {
  WEEKDAYS,
  addMonths,
  monthGrid,
  monthLabel,
  weekdayLong,
} from "@/lib/calendar";
import { formatDate, formatTimeRange } from "@/lib/format";
import type { CalendarEvent, DepartmentType } from "@/lib/database.types";

type DeptFilter = DepartmentType | "all";

// Solid dot colors keyed to the shared category palette (globals.css tokens) —
// same hues as the DepartmentBadge. golf/dining/tennis/general reuse the brand
// tokens; pool/social/pro_shop/membership use the extended info/violet/warning/
// neutral hues, so badge and dot can never drift apart again.
const DOT: Record<DepartmentType, string> = {
  golf: "bg-success",
  dining: "bg-accent",
  tennis: "bg-primary",
  general: "bg-muted",
  pool: "bg-info",
  social: "bg-violet",
  pro_shop: "bg-warning",
  membership: "bg-neutral",
};

function dotClass(dept: DepartmentType | null): string {
  return dept ? DOT[dept] : "bg-foreground/40";
}

/** Build a /calendar URL preserving month + department. */
function href(month: string, dept: DeptFilter): string {
  const params = new URLSearchParams({ m: month });
  if (dept !== "all") params.set("dept", dept);
  return `/calendar?${params.toString()}`;
}

export function CalendarView({
  events,
  month,
  dept,
  todayIso,
}: {
  events: CalendarEvent[]; // events across the visible 6-week grid range
  month: string; // "YYYY-MM"
  dept: DeptFilter;
  todayIso: string;
}) {
  const weeks = useMemo(() => monthGrid(month, todayIso), [month, todayIso]);

  // Events keyed by day for grid dots + the desktop day panel.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.event_date);
      if (list) list.push(e);
      else map.set(e.event_date, [e]);
    }
    return map;
  }, [events]);

  // Mobile agenda shows only this month's events, grouped by day.
  const monthEvents = useMemo(
    () => events.filter((e) => e.event_date.slice(0, 7) === month),
    [events, month],
  );
  const groups = useMemo(() => {
    const out: { iso: string; events: CalendarEvent[] }[] = [];
    for (const e of monthEvents) {
      const last = out[out.length - 1];
      if (last && last.iso === e.event_date) last.events.push(e);
      else out.push({ iso: e.event_date, events: [e] });
    }
    return out;
  }, [monthEvents]);

  // Desktop: default the selected day to today (if shown) else the first event.
  const [selected, setSelected] = useState(() => {
    if (todayIso.slice(0, 7) === month) return todayIso;
    return monthEvents[0]?.event_date ?? `${month}-01`;
  });
  const selectedEvents = byDay.get(selected) ?? [];

  const filters: { value: DeptFilter; label: string }[] = [
    { value: "all", label: "All" },
    ...DEPARTMENTS.map((d) => ({ value: d.value, label: d.label })),
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar: month navigation */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h1 text-foreground">{monthLabel(month)}</h2>
        <div className="flex items-center gap-1">
          <NavButton href={href(addMonths(month, -1), dept)} label="Previous month">
            <ChevronIcon dir="left" />
          </NavButton>
          <Link
            href={href(todayIso.slice(0, 7), dept)}
            scroll={false}
            className="btn btn-ghost"
          >
            Today
          </Link>
          <NavButton href={href(addMonths(month, 1), dept)} label="Next month">
            <ChevronIcon dir="right" />
          </NavButton>
        </div>
      </div>

      {/* Department filter chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {filters.map((f) => {
          const active = f.value === dept;
          return (
            <Link
              key={f.value}
              href={href(month, f.value)}
              scroll={false}
              className={cn(
                // min-h-11 keeps the tap target >=44px on phones; sm:min-h-0
                // returns it to the compact chip height on desktop.
                "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors sm:min-h-0",
                active
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-foreground hover:bg-surface-2",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Desktop: month grid + selected-day panel */}
      <div className="card hidden p-3 sm:p-4 md:block">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="pb-1 text-center text-caption font-semibold uppercase tracking-wide text-muted"
            >
              {w}
            </div>
          ))}
          {weeks.flat().map((cell) => {
            const dayEvents = byDay.get(cell.iso) ?? [];
            const isSelected = cell.iso === selected;
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelected(cell.iso)}
                aria-pressed={isSelected}
                aria-label={`${formatDate(cell.iso)}${
                  dayEvents.length
                    ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}`
                    : ""
                }`}
                className={cn(
                  "flex aspect-square flex-col items-center gap-1 rounded-lg p-1.5 transition-colors",
                  cell.inMonth ? "hover:bg-surface-2" : "text-muted/40",
                  isSelected && "bg-primary/5 ring-2 ring-primary",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-sm",
                    cell.isToday && "bg-primary font-semibold text-white",
                  )}
                >
                  {cell.day}
                </span>
                {dayEvents.length > 0 && (
                  <span className="flex flex-wrap items-center justify-center gap-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          dotClass(e.department),
                        )}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-2xs font-medium text-muted">
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <h3 className="mb-2 text-h2 text-foreground">{formatDate(selected)}</h3>
          {selectedEvents.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted">
              No events scheduled for this day.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {selectedEvents.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: agenda grouped by day */}
      <div className="space-y-5 md:hidden">
        {groups.length === 0 ? (
          <EmptyState
            title="No events this month"
            description="Use the arrows above to browse other months."
          />
        ) : (
          groups.map((g) => (
            <div key={g.iso} className="space-y-2">
              <div className="flex items-center gap-3 px-1">
                <DateChip dateStr={g.iso} />
                <div className="leading-tight">
                  <p className="font-medium text-foreground">
                    {weekdayLong(g.iso)}
                  </p>
                  <p className="text-caption text-muted">
                    {g.events.length} event{g.events.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="card divide-y divide-border overflow-hidden">
                {g.events.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** One tappable event row linking to its detail page. */
function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={`/calendar/${event.id}`}
      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-surface-2"
    >
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          dotClass(event.department),
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{event.title}</p>
        <p className="truncate text-caption text-muted">
          {formatTimeRange(event.start_time, event.end_time)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>
      {event.department && <DepartmentBadge department={event.department} />}
      <ChevronIcon dir="right" className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}

function NavButton({
  href: to,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={to}
      scroll={false}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface-2 sm:h-9 sm:w-9"
    >
      {children}
    </Link>
  );
}

function ChevronIcon({
  dir,
  className,
}: {
  dir: "left" | "right";
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={cn("h-5 w-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
