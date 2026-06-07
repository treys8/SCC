import type {
  DepartmentType,
  ReservationStatus,
  UserRole,
} from "@/lib/database.types";

export const DEPARTMENTS: { value: DepartmentType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "golf", label: "Golf" },
  { value: "dining", label: "Dining" },
  { value: "tennis", label: "Tennis" },
  { value: "pool", label: "Pool" },
  { value: "social", label: "Social & Events" },
  { value: "pro_shop", label: "Pro Shop" },
  { value: "membership", label: "Membership" },
];

export const DEPARTMENT_LABEL: Record<DepartmentType, string> = {
  general: "General",
  golf: "Golf",
  dining: "Dining",
  tennis: "Tennis",
  pool: "Pool",
  social: "Social & Events",
  pro_shop: "Pro Shop",
  membership: "Membership",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  member: "Member",
  staff: "Staff",
  admin: "Admin",
};

export const ROLES: UserRole[] = ["member", "staff", "admin"];

export const RESERVATION_STATUSES: ReservationStatus[] = [
  "pending",
  "confirmed",
  "declined",
  "cancelled",
];

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};
