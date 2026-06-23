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
    <div className="card space-y-3 p-5">
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

      {pool.message && <p className="text-sm text-foreground">{pool.message}</p>}

      {pool.details.length > 0 && (
        <dl className="divide-y divide-border/60">
          {pool.details.map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className="flex items-baseline gap-4 py-2"
            >
              <dt className="w-28 shrink-0 text-sm font-medium text-foreground">
                {row.label}
              </dt>
              <dd className="text-sm text-muted">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
