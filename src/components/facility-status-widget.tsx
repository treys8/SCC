"use client";

import { FacilityStatusBadge } from "@/components/badges";
import { ConditionEditor } from "@/components/condition-editor";
import { FACILITY_LABEL } from "@/lib/constants";
import { isConditionsStale } from "@/lib/facility";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { useLiveFacilityStatus } from "@/lib/use-live-facility-status";
import type { FacilityStatus } from "@/lib/database.types";

/**
 * The /manage/conditions staff console: a card per facility with one-tap
 * preset controls and a note input (ConditionEditor). Realtime-backed via
 * `useLiveFacilityStatus`, so a staffer's change lands immediately and is
 * reconciled with the authoritative row. The read-only member-facing card is a
 * separate component (ConditionsGrid), which is itself realtime.
 */
export function FacilityStatusWidget({
  initial,
  canManage = false,
}: {
  initial: FacilityStatus[];
  canManage?: boolean;
}) {
  const [rows, mergeRow] = useLiveFacilityStatus(initial);
  // "Needs refresh" depends on the current clock, so only judge it after hydration:
  // the server HTML and first client render agree (no pill), then it appears.
  const hydrated = useHydrated();

  if (rows.length === 0) return null;

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((row) => (
        <FacilityRow
          key={row.facility}
          row={row}
          canManage={canManage}
          hydrated={hydrated}
          onOptimistic={mergeRow}
        />
      ))}
    </ul>
  );
}

function FacilityRow({
  row,
  canManage,
  hydrated,
  onOptimistic,
}: {
  row: FacilityStatus;
  canManage: boolean;
  hydrated: boolean;
  onOptimistic: (next: FacilityStatus) => void;
}) {
  return (
    <li className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {FACILITY_LABEL[row.facility]}
          </p>
          {row.message && (
            <p className="mt-0.5 text-sm text-muted">{row.message}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <FacilityStatusBadge status={row.status} />
          {hydrated && canManage && isConditionsStale(row.updated_at) && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-caption font-medium text-warning-strong">
              Needs refresh
            </span>
          )}
          <time
            dateTime={row.updated_at}
            title={formatTimestamp(row.updated_at)}
            suppressHydrationWarning
            className="text-caption text-muted"
          >
            Updated {formatRelativeTime(row.updated_at)}
          </time>
        </div>
      </div>

      {canManage && (
        <div className="mt-3">
          <ConditionEditor row={row} onOptimistic={onOptimistic} />
        </div>
      )}
    </li>
  );
}
