"use client";

import { FacilityStatusBadge } from "@/components/badges";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import { useLiveFacilityStatus } from "@/lib/use-live-facility-status";
import type { FacilityStatus } from "@/lib/database.types";

/**
 * Compact, live pool status for the Pool page — status badge, last-updated time,
 * the optional staff note, and any detail rows. Seeded from the server fetch and
 * kept live via `useLiveFacilityStatus`, so a lightning hold or "Pool closed"
 * lands without a reload. The full standalone view stays at /facility/pool.
 */
export function PoolStatus({ initial }: { initial: FacilityStatus[] }) {
  const [rows] = useLiveFacilityStatus(initial);
  const pool = rows.find((r) => r.facility === "pool");
  if (!pool) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FacilityStatusBadge status={pool.status} />
        <time
          dateTime={pool.updated_at}
          title={formatTimestamp(pool.updated_at)}
          suppressHydrationWarning
          className="text-caption text-muted"
        >
          Updated {formatRelativeTime(pool.updated_at)}
        </time>
      </div>

      {pool.message && (
        <p className="border-l-2 border-accent pl-4 font-serif text-lg text-foreground italic">
          {pool.message}
        </p>
      )}

      {pool.details.length > 0 && (
        <dl className="rule-list">
          {pool.details.map((row, i) => (
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
      )}
    </div>
  );
}
