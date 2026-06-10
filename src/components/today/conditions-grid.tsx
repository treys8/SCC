import Link from "next/link";
import { cn } from "@/lib/cn";
import { FACILITY_LABEL, FACILITY_STATUS_LABEL } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import type {
  FacilityStatus,
  FacilityStatusType,
} from "@/lib/database.types";

/**
 * "Course & pool conditions" — the page's centrepiece. Two cards, Golf and
 * Pool, each with a real open/closed badge, an optional staff message, and a
 * list of labelled detail rows. All staff-set from the /facility console:
 * status + message + the detail rows (facility_status.details) are live data.
 */

const BADGE: Record<FacilityStatusType, string> = {
  open: "bg-success/10 text-success",
  closed: "bg-danger/10 text-danger",
  frost_delay: "bg-info-soft text-info-strong",
  rain_delay: "bg-neutral-soft text-neutral-strong",
  lightning_hold: "bg-warning-soft text-warning-strong",
};

export function ConditionsGrid({
  facilities,
  canManage = false,
}: {
  facilities: FacilityStatus[];
  canManage?: boolean;
}) {
  // The most-recent staff update across the facilities drives the stamp.
  const lastUpdated = facilities
    .map((f) => f.updated_at)
    .sort()
    .at(-1);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h2 text-foreground">Course &amp; pool conditions</h2>
        <span className="shrink-0 text-sm text-accent-600">
          {lastUpdated && `Updated ${formatRelativeTime(lastUpdated)}`}
          {canManage && (
            <>
              {lastUpdated && " · "}
              <Link href="/facility" className="font-medium">
                Manage →
              </Link>
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {facilities.map((f) => (
          <ConditionCard key={f.facility} facility={f} />
        ))}
      </div>
    </section>
  );
}

function ConditionCard({ facility }: { facility: FacilityStatus }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-h2 text-foreground">
          {FACILITY_LABEL[facility.facility]}
        </h3>
        <span className={cn("badge", BADGE[facility.status])}>
          {FACILITY_STATUS_LABEL[facility.status]}
        </span>
      </div>

      {facility.message && (
        <p className="mt-2 text-sm text-muted">{facility.message}</p>
      )}

      {facility.details.length > 0 && (
        <dl className="mt-4">
          {facility.details.map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className={cn(
                "flex items-baseline gap-3 py-2 text-sm",
                i > 0 && "border-t border-border/60",
              )}
            >
              <dt className="w-20 shrink-0 font-medium text-foreground">
                {row.label}
              </dt>
              <dd className="text-muted">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
