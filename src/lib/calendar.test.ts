import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addMonths,
  dayNumber,
  gridRange,
  monthGrid,
  monthLabel,
  parseMonth,
  weekdayLong,
} from "./calendar";

/**
 * Date math for the month grid. All of it is pure and all of it is the kind of
 * thing that silently drifts by a day, so it's worth pinning down.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Freeze the clock at a UTC instant, as the Vercel runtime would see it. */
function atUTC(instant: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));
}

describe("parseMonth", () => {
  it("accepts a well-formed key", () => {
    expect(parseMonth("2026-03")).toEqual({
      year: 2026,
      month: 3,
      key: "2026-03",
    });
  });

  it("keeps the zero-padded key rather than rebuilding it", () => {
    expect(parseMonth("2026-01").key).toBe("2026-01");
    expect(parseMonth("2026-12")).toEqual({
      year: 2026,
      month: 12,
      key: "2026-12",
    });
  });

  it.each(["", "2026-3", "2026/03", "not-a-month", "20263", "2026-13", "2026-00"])(
    "falls back for malformed input %o",
    (input) => {
      atUTC("2026-03-15T12:00:00Z");
      expect(parseMonth(input).key).toBe("2026-03");
    },
  );

  it.each([undefined, null])("falls back for %o", (input) => {
    atUTC("2026-03-15T12:00:00Z");
    expect(parseMonth(input).key).toBe("2026-03");
  });

  // The regression this suite exists for: the server clock is UTC on Vercel, so
  // late on the last evening of a month the two disagree about which month it
  // is. The calendar must open on the club's month, matching the `todayIso` the
  // page hands the grid — otherwise it renders a month with no Today cell.
  it("uses club time, not the server's, at a month boundary", () => {
    atUTC("2026-07-01T00:30:00Z"); // 7:30 PM CDT on Jun 30
    expect(parseMonth(undefined)).toEqual({
      year: 2026,
      month: 6,
      key: "2026-06",
    });
  });

  it("agrees with the server clock away from the boundary", () => {
    atUTC("2026-06-30T17:00:00Z"); // noon CDT on Jun 30
    expect(parseMonth(undefined).key).toBe("2026-06");
  });

  it("rolls the year in club time too", () => {
    atUTC("2027-01-01T02:00:00Z"); // 8 PM CST on Dec 31
    expect(parseMonth(undefined)).toEqual({
      year: 2026,
      month: 12,
      key: "2026-12",
    });
  });
});

describe("addMonths", () => {
  it("steps forward and back", () => {
    expect(addMonths("2026-06", 1)).toBe("2026-07");
    expect(addMonths("2026-06", -1)).toBe("2026-05");
  });

  it("rolls the year in both directions", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("handles multi-month jumps", () => {
    expect(addMonths("2026-06", 12)).toBe("2027-06");
    expect(addMonths("2026-06", -18)).toBe("2024-12");
  });
});

describe("gridRange", () => {
  it("starts on the Sunday on or before the 1st and spans 42 days", () => {
    // Jun 2026 starts on a Monday, so the grid backs up to Sun May 31.
    expect(gridRange("2026-06")).toEqual({ start: "2026-05-31", end: "2026-07-11" });
  });

  it("starts on the 1st when the month already begins on a Sunday", () => {
    // Feb 2026 starts on a Sunday.
    expect(gridRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-03-14" });
  });

  it("crosses a year boundary", () => {
    expect(gridRange("2027-01")).toEqual({ start: "2026-12-27", end: "2027-02-06" });
  });

  it("always covers exactly six weeks", () => {
    for (const key of ["2026-02", "2026-06", "2026-11", "2027-01"]) {
      const { start, end } = gridRange(key);
      const days =
        (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
      expect(days).toBe(41);
    }
  });
});

describe("monthGrid", () => {
  it("is six rows of seven days", () => {
    const grid = monthGrid("2026-06", "2026-06-15");
    expect(grid).toHaveLength(6);
    for (const week of grid) expect(week).toHaveLength(7);
  });

  it("agrees with gridRange on its first and last cell", () => {
    const grid = monthGrid("2026-06", "2026-06-15");
    const { start, end } = gridRange("2026-06");
    expect(grid[0][0].iso).toBe(start);
    expect(grid[5][6].iso).toBe(end);
  });

  it("flags spillover days as out of month", () => {
    const grid = monthGrid("2026-06", "2026-06-15");
    const cells = grid.flat();
    expect(cells.find((c) => c.iso === "2026-05-31")?.inMonth).toBe(false);
    expect(cells.find((c) => c.iso === "2026-06-01")?.inMonth).toBe(true);
    expect(cells.find((c) => c.iso === "2026-06-30")?.inMonth).toBe(true);
    expect(cells.find((c) => c.iso === "2026-07-01")?.inMonth).toBe(false);
  });

  it("marks exactly the day matching todayIso", () => {
    const marked = monthGrid("2026-06", "2026-06-15")
      .flat()
      .filter((c) => c.isToday);
    expect(marked).toHaveLength(1);
    expect(marked[0].iso).toBe("2026-06-15");
  });

  it("marks nothing when today falls outside the grid", () => {
    const grid = monthGrid("2026-06", "2027-01-04");
    expect(grid.flat().some((c) => c.isToday)).toBe(false);
  });

  it("numbers days from the ISO date", () => {
    const grid = monthGrid("2026-06", "2026-06-15");
    expect(grid[0][0]).toMatchObject({ iso: "2026-05-31", day: 31 });
    expect(grid[0][1]).toMatchObject({ iso: "2026-06-01", day: 1 });
  });
});

describe("date string helpers", () => {
  it("reads the day of month", () => {
    expect(dayNumber("2026-06-07")).toBe(7);
    expect(dayNumber("2026-06-30")).toBe(30);
  });

  it("names the weekday", () => {
    expect(weekdayLong("2026-06-07")).toBe("Sunday");
    expect(weekdayLong("2026-06-08")).toBe("Monday");
  });

  it("labels a month", () => {
    expect(monthLabel("2026-06")).toBe("June 2026");
    expect(monthLabel("2027-01")).toBe("January 2027");
  });
});
