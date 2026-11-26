"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { FACILITY_LABEL, FACILITY_STATUS_LABEL } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { useLiveFacilityStatus } from "@/lib/use-live-facility-status";
import type { FacilityStatus, FacilityStatusType } from "@/lib/database.types";

/**
 * Member "Conditions" — one hairline strip directly under the Today hero: a
 * column per facility with a small-caps label, the status set in serif beside
 * a coloured dot, and a one-line detail. Four across on desktop, 2×2 on
 * phones. Each cell links into that facility's detail page. Seeded from the
 * server rows and kept live via `useLiveFacilityStatus`, so a staff change
 * lands without a reload. Staff get the editable FacilityStatusWidget instead
 * (see the Today page's `canManage` branch).
 *
 * The detail line uses `message` when set, else the first detail row's value;
 * a facility with neither simply shows its status.
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
    <section aria-labelledby="conditions-heading">
      <h2 id="conditions-heading" className="sr-only">
        Conditions
      </h2>
      {/* gap-px over a hairline-coloured background draws the dividers, so the
          same markup gives 4 columns (lg) or a 2×2 grid without per-cell
          border bookkeeping. */}
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
        {rows.map((f) => (
          <ConditionCell key={f.facility} facility={f} />
        ))}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3 text-caption tracking-[0.04em] text-muted">
        <span className="font-semibold tracking-[0.16em] uppercase">
          Conditions
        </span>
        {lastUpdated && (
          <time dateTime={lastUpdated} suppressHydrationWarning>
            Updated {formatRelativeTime(lastUpdated)}
          </time>
        )}
      </div>
    </section>
  );
}

/** Status word + dot colour, from the same palette as FacilityStatusBadge. */
const STATUS_TONE: Record<FacilityStatusType, string> = {
  open: "text-primary",
  closed: "text-danger",
  frost_delay: "text-info-strong",
  rain_delay: "text-neutral-strong",
  lightning_hold: "text-warning-strong",
};

/** The one-line glance: the staff note, else the first detail row. */
function detailLine(facility: FacilityStatus): string | null {
  if (facility.message) return facility.message;
  const first = facility.details[0];
  return first ? `${first.label} · ${first.value}` : null;
}

function ConditionCell({ facility }: { facility: FacilityStatus }) {
  const detail = detailLine(facility);
  return (
    <Link
      href={`/facility/${facility.facility}`}
      className="group bg-background px-4 py-5 transition-colors hover:bg-surface-2 max-lg:odd:pl-0 sm:px-6 sm:py-7 lg:first:pl-0"
    >
      <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-muted uppercase">
        {FACILITY_LABEL[facility.facility]}
      </p>
      <p
        className={cn(
          "mt-2.5 flex items-center gap-2.5 font-serif text-2xl leading-none sm:text-[1.7rem]",
          STATUS_TONE[facility.status],
        )}
      >
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full bg-current shadow-[0_0_0_4px_color-mix(in_oklab,currentColor_14%,transparent)]"
        />
        {FACILITY_STATUS_LABEL[facility.status]}
      </p>
      {detail && (
        <p className="mt-2 line-clamp-2 text-[0.84rem] leading-snug text-muted">
          {detail}
        </p>
      )}
    </Link>
  );
}
