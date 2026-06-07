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
];

export const DEPARTMENT_LABEL: Record<DepartmentType, string> = {
  general: "General",
  golf: "Golf",
  dining: "Dining",
  tennis: "Tennis",
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
  "cancelled",
];

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};
