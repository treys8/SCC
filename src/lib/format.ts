/**
 * Date/time formatting that avoids timezone drift by treating the
 * date/time strings as wall-clock values (not UTC instants).
 */

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

/** ISO timestamp -> "Jun 7, 2026, 6:30 PM" */
export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
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

  // Older than a week: show the date (drop the year if it's this year).
  const date = new Date(ts);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
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
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

/** Today as "YYYY-MM-DD" in local time (for date input min). */
export function todayISO(): string {
  const now = new Date();
  const off = now.getTimezoneOffset();
  return new Date(now.getTime() - off * 60_000).toISOString().slice(0, 10);
}
