/**
 * Month-grid math for the club calendar. Every date is a wall-clock
 * "YYYY-MM-DD" string (local), consistent with lib/format.ts — no UTC drift.
 */

export type DayCell = {
  iso: string; // "YYYY-MM-DD"
  day: number; // 1..31
  inMonth: boolean; // belongs to the displayed month (not a spillover day)
  isToday: boolean;
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Current month as "YYYY-MM" in local time. */
export function currentMonth(): string {
  return ym(new Date());
}

/** Parse/validate a "YYYY-MM" value, falling back to the current month. */
export function parseMonth(value: string | undefined | null): {
  year: number;
  month: number; // 1..12
  key: string; // normalized "YYYY-MM"
} {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { year, month, key: `${m[1]}-${m[2]}` };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, key: ym(now) };
}

/** Shift a "YYYY-MM" key by n months (n may be negative). */
export function addMonths(key: string, n: number): string {
  const { year, month } = parseMonth(key);
  return ym(new Date(year, month - 1 + n, 1));
}

/** "June 2026" */
export function monthLabel(key: string): string {
  const { year, month } = parseMonth(key);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** A 6×7 grid of day cells (weeks start Sunday) covering the given month. */
export function monthGrid(key: string, todayIso: string): DayCell[][] {
  const { year, month } = parseMonth(key);
  const first = new Date(year, month - 1, 1);
  const cursor = new Date(year, month - 1, 1 - first.getDay()); // back up to Sunday
  const weeks: DayCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = isoOf(cursor);
      week.push({
        iso,
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month - 1,
        isToday: iso === todayIso,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** First/last ISO date visible in the 6-week grid — the range to query events for. */
export function gridRange(key: string): { start: string; end: string } {
  const { year, month } = parseMonth(key);
  const first = new Date(year, month - 1, 1);
  const start = new Date(year, month - 1, 1 - first.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 41); // 6 weeks − 1 day
  return { start: isoOf(start), end: isoOf(end) };
}

/** Day-of-month number from a "YYYY-MM-DD" string. */
export function dayNumber(iso: string): number {
  return Number(iso.split("-")[2]);
}

/** "Saturday" for a "YYYY-MM-DD" string. */
export function weekdayLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
}
