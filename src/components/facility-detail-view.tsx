"use client";

import { PageHeader } from "@/components/page-header";
import { FacilityStatusBadge } from "@/components/badges";
import { FacilityIcon } from "@/components/facility-icon";
import { FACILITY_LABEL } from "@/lib/constants";
import {
  formatDateShort,
  formatRelativeTime,
  formatTimestamp,
} from "@/lib/format";
import { useLiveFacilityStatus } from "@/lib/use-live-facility-status";
import type {
  FacilityStatus,
  FacilityType,
  UpcomingGolfEvent,
} from "@/lib/database.types";

/**
 * Read-only member view of one facility's conditions: status badge, the optional
 * staff note, and every detail row. Seeded from the server-fetched rows and kept
 * live via `useLiveFacilityStatus`, so a staff change updates the page without a
 * reload. The matching facility is selected from the live array by `type`.
 */
export function FacilityDetailView({
  initial,
  type,
  upcoming = [],
}: {
  initial: FacilityStatus[];
  type: FacilityType;
  upcoming?: UpcomingGolfEvent[];
}) {
  const [rows] = useLiveFacilityStatus(initial);
  const facility = rows.find((r) => r.facility === type);
  if (!facility) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={FACILITY_LABEL[facility.facility]}
        eyebrow="Conditions"
        back={{ href: "/", label: "Today" }}
      />

      <header className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/25 text-primary">
          <FacilityIcon facility={facility.facility} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FacilityStatusBadge status={facility.status} />
            <time
              dateTime={facility.updated_at}
              title={formatTimestamp(facility.updated_at)}
              suppressHydrationWarning
              className="text-caption text-muted"
            >
              Updated {formatRelativeTime(facility.updated_at)}
            </time>
          </div>
        </div>
      </header>

      {facility.message && (
        <p className="border-l-2 border-accent pl-4 font-serif text-lg leading-snug text-foreground italic sm:text-xl">
          {facility.message}
        </p>
      )}

      {facility.details.length > 0 ? (
        <dl className="rule-list">
          {facility.details.map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className="flex items-baseline justify-between gap-4 py-3.5"
            >
              <dt className="text-[0.92rem] tracking-[0.03em] text-muted">
                {row.label}
              </dt>
              <dd className="text-right text-[0.92rem] font-medium text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="font-serif text-lg text-muted italic">
          No additional details right now.
        </p>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-5">
          <h2 className="text-section text-foreground">Upcoming on the course</h2>
          <ul className="rule-list">
            {upcoming.map((ev) => (
              <li key={ev.id} className="flex items-start gap-4 py-4">
                <span className="mt-1 w-16 shrink-0 text-[0.7rem] font-semibold tracking-[0.14em] text-gold-ink uppercase">
                  {formatDateShort(ev.event_date)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg text-foreground">
                    {ev.title}
                  </p>
                  {ev.schedule_note && (
                    <p className="mt-0.5 text-caption text-muted">
                      {ev.schedule_note}
                    </p>
                  )}
                </div>
                {ev.registration_url && (
                  <a
                    href={ev.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm shrink-0"
                  >
                    Register
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
