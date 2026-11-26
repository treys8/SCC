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
    <div className="space-y-6">
      {/* Toolbar: month navigation */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-3xl text-foreground sm:text-4xl">
          {monthLabel(month)}
        </h2>
        <div className="flex items-center gap-1">
          <NavButton href={href(addMonths(month, -1), dept)} label="Previous month">
            <ChevronIcon dir="left" />
          </NavButton>
          <Link
            href={href(todayIso.slice(0, 7), dept)}
            scroll={false}
            className="btn btn-outline btn-sm"
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
              className={cn("chip", active && "chip-active")}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Desktop: month grid + selected-day panel */}
      <div className="hidden md:block">
        {/* Hairline grid: gap-px over a border-coloured ground draws the rules. */}
        <div className="grid grid-cols-7 gap-px border border-border bg-border">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="bg-background px-3 py-2.5 text-[0.66rem] font-semibold tracking-[0.18em] text-muted uppercase"
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
                  "flex min-h-24 flex-col items-start gap-2 p-2.5 text-left transition-colors lg:min-h-28",
                  cell.inMonth
                    ? "bg-surface hover:bg-surface-2"
                    : "bg-background text-muted/40",
                  isSelected && "bg-accent/[0.08] shadow-[inset_0_0_0_1.5px_var(--primary)] hover:bg-accent/[0.08]",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full font-serif text-[1.05rem]",
                    cell.isToday && "bg-green-deep text-gold-soft",
                  )}
                >
                  {cell.day}
                </span>
                {dayEvents.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={cn(
                          "h-2 w-2 rounded-full",
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

        <div className="mt-10">
          <div className="section-rule">
            <h3 className="text-section text-foreground">
              {formatDate(selected)}
            </h3>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="py-2 font-serif text-lg text-muted italic">
              Nothing scheduled this day.
            </p>
          ) : (
            <div className="rule-list">
              {selectedEvents.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: agenda grouped by day */}
      <div className="space-y-8 md:hidden">
        {groups.length === 0 ? (
          <EmptyState
            title="No events this month"
            description="Use the arrows above to browse other months."
          />
        ) : (
          groups.map((g) => (
            <div key={g.iso} className="space-y-3">
              <div className="flex items-center gap-3">
                <DateChip dateStr={g.iso} />
                <div className="leading-tight">
                  <p className="font-serif text-xl text-foreground">
                    {weekdayLong(g.iso)}
                  </p>
                  <p className="text-caption text-muted">
                    {g.events.length} event{g.events.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="rule-list">
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
      className="group flex items-center gap-3 py-4"
    >
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          dotClass(event.department),
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-lg text-foreground transition-colors group-hover:text-primary">
          {event.title}
        </p>
        <p className="truncate text-caption text-muted">
          {formatTimeRange(event.start_time, event.end_time)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>
      {event.department && <DepartmentBadge department={event.department} />}
      <ChevronIcon dir="right" className="h-4 w-4 shrink-0 text-gold-ink" />
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
      className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-primary/40 hover:bg-surface sm:h-9 sm:w-9"
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
