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
  dining: "bg-accent/15 text-accent-600",
  tennis: "bg-primary/10 text-primary",
  general: "bg-foreground/5 text-muted",
  pool: "bg-sky-100 text-sky-700",
  social: "bg-violet-100 text-violet-700",
  pro_shop: "bg-amber-100 text-amber-800",
  membership: "bg-slate-100 text-slate-700",
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

const STATUS_STYLES: Record<ReservationStatus, string> = {
  pending: "bg-accent/15 text-accent-600",
  confirmed: "bg-success/10 text-success",
  declined: "bg-danger/10 text-danger",
  cancelled: "bg-foreground/5 text-muted",
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
  frost_delay: "bg-sky-100 text-sky-700",
  rain_delay: "bg-slate-100 text-slate-700",
  lightning_hold: "bg-amber-100 text-amber-800",
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
