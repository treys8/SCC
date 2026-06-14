import type {
  DepartmentType,
  DocumentCategory,
  FacilityStatusType,
  FacilityType,
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

/** Document-library categories, in display order, with member-facing labels. */
export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "menu", label: "Menus" },
  { value: "pool", label: "Pool" },
  { value: "newsletter", label: "Newsletters" },
  { value: "form", label: "Forms" },
  { value: "general", label: "General" },
];

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  menu: "Menus",
  pool: "Pool",
  newsletter: "Newsletters",
  form: "Forms",
  general: "General",
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

/**
 * The club's location, used for the Today-page weather glance. Coordinates are
 * Starkville Country Club; adjust if the weather looks off for the property.
 */
export const CLUB_COORDS = { lat: 33.45, lng: -88.79 } as const;
/** IANA timezone the club operates in (Open-Meteo localizes against this). */
export const CLUB_TZ = "America/Chicago";

/** The club's name, shown as the byline on official (club-voice) feed posts. */
export const CLUB_NAME = "Starkville Country Club";

/** Facilities with a member-facing operational status, in display order. */
export const FACILITIES: FacilityType[] = [
  "golf",
  "driving_range",
  "pool",
  "tennis",
];

/**
 * How long a facility's conditions can sit untouched before staff are nudged to
 * refresh them (tile badge, per-row "Needs refresh" pill, and the morning cron).
 * Members never see this — their "Updated …" stamp stays honest.
 */
export const CONDITIONS_STALE_HOURS = 24;

export const FACILITY_LABEL: Record<FacilityType, string> = {
  golf: "Golf Course",
  driving_range: "Driving Range",
  pool: "Pool",
  tennis: "Tennis Courts",
};

export const FACILITY_STATUS_LABEL: Record<FacilityStatusType, string> = {
  open: "Open",
  closed: "Closed",
  frost_delay: "Frost delay",
  rain_delay: "Rain delay",
  lightning_hold: "Lightning hold",
};

/**
 * Staff one-tap presets, in display order. "Open" and "All clear" both set the
 * `open` status — "All clear" is the friendlier label for lifting a weather
 * hold. Tapping any preset clears the facility's custom message.
 */
export const FACILITY_PRESETS: { label: string; status: FacilityStatusType }[] = [
  { label: "Frost", status: "frost_delay" },
  { label: "Rain", status: "rain_delay" },
  { label: "Lightning hold", status: "lightning_hold" },
  { label: "Closed", status: "closed" },
  { label: "Open", status: "open" },
  { label: "All clear", status: "open" },
];
