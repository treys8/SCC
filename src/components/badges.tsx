import { cn } from "@/lib/cn";
import {
  DEPARTMENT_LABEL,
  FACILITY_STATUS_LABEL,
  STATUS_LABEL,
} from "@/lib/constants";
import type {
  DepartmentType,
  FacilityStatusType,
  ReservationStatus,
} from "@/lib/database.types";

const DEPT_STYLES: Record<DepartmentType, string> = {
  golf: "bg-success/10 text-success",
  dining: "bg-accent/10 text-accent-600",
  tennis: "bg-primary/10 text-primary",
  general: "bg-foreground/10 text-muted",
  pool: "bg-info-soft text-info-strong",
  social: "bg-violet-soft text-violet-strong",
  pro_shop: "bg-warning-soft text-warning-strong",
  membership: "bg-neutral-soft text-neutral-strong",
};

export function DepartmentBadge({
  department,
}: {
  department: DepartmentType;
}) {
  return (
    <span className={cn("badge", DEPT_STYLES[department])}>
      {DEPARTMENT_LABEL[department]}
    </span>
  );
}

/**
 * Solid department hue + matching text colour for the feed's category-led club
 * posts (the 3px left accent bar, the header dot, and the uppercase label).
 * Same hues as the DEPT_STYLES badge tints above, at full strength.
 */
export const DEPARTMENT_ACCENT: Record<
  DepartmentType,
  { bar: string; text: string }
> = {
  golf: { bar: "bg-success", text: "text-success" },
  dining: { bar: "bg-accent", text: "text-accent-600" },
  tennis: { bar: "bg-primary", text: "text-primary" },
  general: { bar: "bg-muted", text: "text-muted" },
  pool: { bar: "bg-info", text: "text-info-strong" },
  social: { bar: "bg-violet", text: "text-violet-strong" },
  pro_shop: { bar: "bg-warning", text: "text-warning-strong" },
  membership: { bar: "bg-neutral", text: "text-neutral-strong" },
};

const STATUS_STYLES: Record<ReservationStatus, string> = {
  pending: "bg-accent/10 text-accent-600",
  confirmed: "bg-success/10 text-success",
  declined: "bg-danger/10 text-danger",
  cancelled: "bg-foreground/10 text-muted",
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span className={cn("badge", STATUS_STYLES[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const FACILITY_STATUS_STYLES: Record<FacilityStatusType, string> = {
  open: "bg-success/10 text-success",
  closed: "bg-danger/10 text-danger",
  frost_delay: "bg-info-soft text-info-strong",
  rain_delay: "bg-neutral-soft text-neutral-strong",
  lightning_hold: "bg-warning-soft text-warning-strong",
};

export function FacilityStatusBadge({
  status,
}: {
  status: FacilityStatusType;
}) {
  return (
    <span className={cn("badge", FACILITY_STATUS_STYLES[status])}>
      {FACILITY_STATUS_LABEL[status]}
    </span>
  );
}

export function ContactStatusBadge({ resolved }: { resolved: boolean }) {
  return (
    <span
      className={cn(
        "badge",
        resolved ? "bg-success/10 text-success" : "bg-accent/10 text-accent-600",
      )}
    >
      {resolved ? "Resolved" : "Open"}
    </span>
  );
}
