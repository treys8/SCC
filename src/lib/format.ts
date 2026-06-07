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

/** Today as "YYYY-MM-DD" in local time (for date input min). */
export function todayISO(): string {
  const now = new Date();
  const off = now.getTimezoneOffset();
  return new Date(now.getTime() - off * 60_000).toISOString().slice(0, 10);
}
