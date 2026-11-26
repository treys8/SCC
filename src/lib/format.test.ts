import { describe, expect, it } from "vitest";
import { conditionsSince, conditionsStamp } from "./format";

// Club time is America/Chicago. Nov 26 2026 is CST (UTC-6); Jul is CDT (UTC-5).
const now = new Date("2026-11-26T18:00:00Z"); // Thu Nov 26, 12:00 PM CST

describe("conditionsStamp", () => {
  it("says Just now inside a minute (and for slight clock skew)", () => {
    expect(conditionsStamp("2026-11-26T17:59:30Z", now)).toBe("Just now");
    expect(conditionsStamp("2026-11-26T18:00:20Z", now)).toBe("Just now");
  });
  it("shows the club-time clock for earlier today", () => {
    expect(conditionsStamp("2026-11-26T13:42:00Z", now)).toBe("7:42 AM");
  });
  it("treats just-after-midnight club time as today, not yesterday", () => {
    // 00:15 CST on Nov 26 is 06:15Z — still Nov 26 in club time.
    expect(conditionsStamp("2026-11-26T06:15:00Z", now)).toBe("12:15 AM");
  });
  it("says Yesterday for the previous club day", () => {
    // 11:30 PM CST Nov 25 = 05:30Z Nov 26 — a UTC 'today' but club 'yesterday'.
    expect(conditionsStamp("2026-11-26T05:30:00Z", now)).toBe("Yesterday");
  });
  it("hides anything older", () => {
    expect(conditionsStamp("2026-11-24T15:00:00Z", now)).toBeNull();
    expect(conditionsStamp("2026-07-17T14:13:05Z", now)).toBeNull();
  });
  it("is null for junk", () => {
    expect(conditionsStamp("not a date", now)).toBeNull();
  });
});

describe("conditionsSince", () => {
  it("is just the clock for today", () => {
    expect(conditionsSince("2026-11-26T13:10:00Z", now)).toBe("7:10 AM");
  });
  it("adds the weekday within six days", () => {
    expect(conditionsSince("2026-11-24T13:10:00Z", now)).toBe("Tue 7:10 AM");
    expect(conditionsSince("2026-11-20T13:10:00Z", now)).toBe("Fri 7:10 AM");
  });
  it("falls back to a date past six days", () => {
    expect(conditionsSince("2026-11-19T13:10:00Z", now)).toBe("Nov 19");
    expect(conditionsSince("2026-09-08T15:00:00Z", now)).toBe("Sep 8");
  });
  it("adds the year across a club-year boundary", () => {
    expect(conditionsSince("2025-12-20T15:00:00Z", now)).toBe("Dec 20, 2025");
  });
  it("uses CDT across the DST change", () => {
    const summer = new Date("2026-07-18T17:00:00Z"); // noon CDT
    expect(conditionsSince("2026-07-18T12:10:00Z", summer)).toBe("7:10 AM");
  });
});
