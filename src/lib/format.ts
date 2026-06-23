/**
 * Date/time formatting that avoids timezone drift by treating the
 * date/time strings as wall-clock values (not UTC instants).
 *
 * Helpers that render a real instant (formatTimestamp / formatRelativeTime) and
 * compute "today" pin to the club's timezone — otherwise they'd render in the
 * server's TZ (UTC on Vercel), giving wrong tooltip times and off-by-one dates.
 */
import { CLUB_TZ } from "@/lib/constants";

/** "2026-06-07" -> "Sun, Jun 7, 2026" */
export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "2026-06-07" -> "Jun 7" */
export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "2026-06-10" -> "Tuesday, June 10" (full weekday + month, no year) */
export function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** "18:30:00" -> "6:30 PM" */
export function formatTime(timeStr: string): string {
  const [h, min] = timeStr.split(":").map(Number);
  const dt = new Date(2000, 0, 1, h, min);
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Start/end time range, e.g. "6:30 PM – 9:00 PM" or just "6:30 PM". */
export function formatTimeRange(
  start: string,
  end: string | null | undefined,
): string {
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

/** ISO timestamp -> "Jun 7, 2026, 6:30 PM" (in club time). */
export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    timeZone: CLUB_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Compact, feed-style age: "now", "5m", "3h", "2d". Past a week it falls back
 * to an absolute date. Pair with `formatTimestamp` as a `title` for the exact
 * time on hover.
 */
export function formatRelativeTime(ts: string): string {
  const then = new Date(ts).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 45) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;

  // Older than a week: show the date in club time (drop the year if it's this
  // year, judged in club time too).
  const date = new Date(ts);
  const clubYear = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: CLUB_TZ, year: "numeric" }).format(d);
  const sameYear = clubYear(date) === clubYear(new Date());
  return date.toLocaleDateString("en-US", {
    timeZone: CLUB_TZ,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Bytes -> "512 KB", "2.4 MB". */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  let rounded =
    value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  // Rounding can land on the unit boundary (e.g. 1023.99 KB → "1024 KB").
  if (rounded >= 1024 && unit < units.length - 1) {
    rounded = 1;
    unit++;
  }
  return `${rounded} ${units[unit]}`;
}

/**
 * Today as "YYYY-MM-DD" in club time. Use this for server-side date validation
 * (e.g. rejecting past reservations) so it doesn't drift to the server's TZ.
 */
export function clubTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLUB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Today + `days` as "YYYY-MM-DD" in club time, for booking-horizon checks. Built
 * on clubTodayISO so it shares the same TZ anchor; wall-clock date math (Date
 * with local components) rolls month/year boundaries correctly.
 */
export function clubDatePlusDaysISO(days: number): string {
  const [y, m, d] = clubTodayISO().split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/**
 * UTC ISO instant of `days` ago from now — a timestamptz lower bound for
 * "active since" windows (compare directly against a timestamptz column, both
 * being ISO-8601 UTC). Lives here so callers don't read the clock during render.
 */
export function instantDaysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** ms to add to a UTC instant to get club-local wall-clock (DST-aware). */
function clubOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // `hour` can read "24" at midnight in some engines; Date.UTC normalizes it.
  const asLocal = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asLocal - utcMs;
}

/**
 * The UTC ISO instant of midnight *club time* on a "YYYY-MM-DD" calendar day.
 * Use to turn a date-only filter into a `timestamptz` bound that matches the
 * club's day rather than the server's UTC day. Club midnight never lands in the
 * DST gap (Chicago shifts at 2 AM), so a single offset correction is exact.
 */
export function clubDayStartUTC(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  return new Date(guess - clubOffsetMs(guess)).toISOString();
}

/**
 * The UTC ISO instant of the *start of the next* club day after "YYYY-MM-DD" —
 * an exclusive upper bound that covers the whole club day (no end-of-day gap).
 */
export function clubDayEndExclusiveUTC(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return clubDayStartUTC(
    `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
  );
}
