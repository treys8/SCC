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

/**
 * One-tap composer starters for recurring staff posts (e.g. the chef's weekly
 * Blue Plate menu). Picking a template pre-fills the category, club voice, and a
 * body skeleton the author fills in — no DB, edit here to add more.
 */
export type PostTemplate = {
  key: string;
  label: string;
  department: DepartmentType;
  asClub: boolean;
  body: string;
};

export const POST_TEMPLATES: PostTemplate[] = [
  {
    key: "blue_plate",
    label: "Weekly Blue Plate Menu",
    department: "dining",
    asClub: true,
    body: "Good Morning!\n\nHere is your blue plate menu for the week:\n\nTuesday– \n\nWednesday– \n\nThursday– \n\nFriday– \n\nHave a great week!",
  },
  {
    key: "golf_preview",
    label: "Weekly Golf Preview",
    department: "golf",
    asClub: true,
    body: "Good morning SCC members,\n\n\n\nThis week on the course\n– \n\nUpcoming events\nThe full season schedule lives on the Golf page. \n\nFrom the golf shop\n– \n\nCourse notes\n– \n\nSee you out there,\n",
  },
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

/** Roles with staff privileges — use for `.in("role", STAFF_ROLES)` queries so
 * the staff-audience filter has a single source of truth (see isStaff()). */
export const STAFF_ROLES: UserRole[] = ["staff", "admin"];

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
