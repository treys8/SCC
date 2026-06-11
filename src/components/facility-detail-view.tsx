"use client";

import Link from "next/link";
import { FacilityStatusBadge } from "@/components/badges";
import { FacilityIcon } from "@/components/facility-icon";
import { FACILITY_LABEL } from "@/lib/constants";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import { useLiveFacilityStatus } from "@/lib/use-live-facility-status";
import type { FacilityStatus, FacilityType } from "@/lib/database.types";

/**
 * Read-only member view of one facility's conditions: status badge, the optional
 * staff note, and every detail row. Seeded from the server-fetched rows and kept
 * live via `useLiveFacilityStatus`, so a staff change updates the page without a
 * reload. The matching facility is selected from the live array by `type`.
 */
export function FacilityDetailView({
  initial,
  type,
}: {
  initial: FacilityStatus[];
  type: FacilityType;
}) {
  const [rows] = useLiveFacilityStatus(initial);
  const facility = rows.find((r) => r.facility === type);
  if (!facility) return null;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-600"
      >
        <span aria-hidden>←</span> Today
      </Link>

      <header className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FacilityIcon facility={facility.facility} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-h1 text-foreground">
            {FACILITY_LABEL[facility.facility]}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
        <p className="card border-l-2 border-l-accent bg-accent/[0.05] p-4 text-sm text-foreground">
          {facility.message}
        </p>
      )}

      {facility.details.length > 0 ? (
        <dl className="card overflow-hidden">
          {facility.details.map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className={
                "flex items-baseline gap-4 px-4 py-3.5 sm:px-5" +
                (i > 0 ? " border-t border-border/60" : "")
              }
            >
              <dt className="w-28 shrink-0 text-sm font-medium text-foreground">
                {row.label}
              </dt>
              <dd className="text-sm text-muted">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="card p-5 text-sm text-muted">
          No additional details right now.
        </p>
      )}
    </div>
  );
}
