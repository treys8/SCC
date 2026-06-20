"use client";

import Link from "next/link";
import { FacilityStatusBadge } from "@/components/badges";
import { FacilityIcon } from "@/components/facility-icon";
import { cn } from "@/lib/cn";
import { FACILITY_LABEL } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { useLiveFacilityStatus } from "@/lib/use-live-facility-status";
import type { FacilityStatus } from "@/lib/database.types";

/**
 * Member "Conditions" — one compact card with a row per facility:
 * [icon · name · one-line summary · status badge · chevron], each row a link
 * into that facility's detail page. Seeded from the server-fetched rows and kept
 * live via `useLiveFacilityStatus`, so a staff status change lands without a
 * reload. Staff get the editable FacilityStatusWidget instead (see the Today
 * page's `canManage` branch).
 *
 * There's no single "summary" field — `details` is an array plus an optional
 * `message`. The summary line uses `message` when set, else the first detail
 * row; the full rows live on the detail page.
 */
export function ConditionsGrid({
  facilities,
}: {
  facilities: FacilityStatus[];
}) {
  const [rows] = useLiveFacilityStatus(facilities);

  if (rows.length === 0) return null;

  // The most-recent staff update across the facilities drives the stamp.
  const lastUpdated = rows
    .map((f) => f.updated_at)
    .sort()
    .at(-1);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h2 text-foreground">Conditions</h2>
        {lastUpdated && (
          <time
            dateTime={lastUpdated}
            suppressHydrationWarning
            className="shrink-0 text-sm text-accent-600"
          >
            Updated {formatRelativeTime(lastUpdated)}
          </time>
        )}
      </div>

      {/* Mobile: one card, a divided row per facility. Desktop (`lg`): the card
          dissolves into a 2×2 grid of self-bordered tiles. */}
      <div className="card overflow-hidden lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none">
        {rows.map((f, i) => (
          <ConditionRow key={f.facility} facility={f} divided={i > 0} />
        ))}
      </div>
    </section>
  );
}

/** The one-line glance under the name: the staff note, else the first detail. */
function summaryLine(facility: FacilityStatus): string | null {
  if (facility.message) return facility.message;
  const first = facility.details[0];
  return first ? `${first.label} · ${first.value}` : null;
}

function ConditionRow({
  facility,
  divided,
}: {
  facility: FacilityStatus;
  divided: boolean;
}) {
  const summary = summaryLine(facility);
  return (
    <Link
      href={`/facility/${facility.facility}`}
      className={cn(
        "flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5",
        divided && "border-t border-border/60",
        // Desktop tile: each row gets its own bordered, rounded card.
        "lg:rounded-xl lg:border lg:border-border lg:bg-surface lg:px-4 lg:py-3.5 lg:shadow-sm",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FacilityIcon facility={facility.facility} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          {FACILITY_LABEL[facility.facility]}
        </p>
        {summary && (
          <p className="mt-0.5 truncate text-sm text-muted">{summary}</p>
        )}
      </div>
      <FacilityStatusBadge status={facility.status} />
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0 text-muted lg:hidden"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
