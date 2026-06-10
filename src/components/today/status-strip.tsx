import { cn } from "@/lib/cn";
import { FACILITY_STATUS_LABEL } from "@/lib/constants";
import type {
  FacilityStatus,
  FacilityStatusType,
  FacilityType,
} from "@/lib/database.types";

/**
 * A compact single-row glance at Golf, Pool, and Dining — a coloured dot plus a
 * one-word status, nothing more. This is deliberately NOT the stacked, realtime
 * "Course & Pool" card the Feed renders; it's a front-door summary. Golf and
 * Pool come from staff-set facility rows; Dining is derived from whether the
 * dinner service window is open right now.
 */
const DOT: Record<FacilityStatusType, string> = {
  open: "bg-success",
  closed: "bg-danger",
  frost_delay: "bg-info",
  rain_delay: "bg-neutral",
  lightning_hold: "bg-warning",
};

/** Short, single-word labels for the strip (vs. FACILITY_LABEL's "Golf Course"). */
const SHORT_LABEL: Record<FacilityType, string> = {
  golf: "Golf",
  pool: "Pool",
};

export function StatusStrip({
  facilities,
  diningOpen,
}: {
  facilities: FacilityStatus[];
  diningOpen: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {facilities.map((f) => (
        <Chip
          key={f.facility}
          label={SHORT_LABEL[f.facility]}
          status={FACILITY_STATUS_LABEL[f.status]}
          dotClass={DOT[f.status]}
        />
      ))}
      <Chip
        label="Dining"
        status={diningOpen ? "Open" : "Closed"}
        dotClass={diningOpen ? "bg-success" : "bg-neutral"}
      />
    </div>
  );
}

function Chip({
  label,
  status,
  dotClass,
}: {
  label: string;
  status: string;
  dotClass: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs shadow-sm">
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-muted">· {status}</span>
    </span>
  );
}
