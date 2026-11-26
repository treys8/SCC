import { describe, expect, it } from "vitest";
import { MAX_EVENT_PARTY, parseCapacity, signupStatus } from "./events";

describe("parseCapacity", () => {
  it("treats blank as uncapped", () => {
    expect(parseCapacity("")).toEqual({ value: null });
    expect(parseCapacity("   ")).toEqual({ value: null });
  });
  it("accepts a positive whole number", () => {
    expect(parseCapacity("48")).toEqual({ value: 48 });
    expect(parseCapacity(" 12 ")).toEqual({ value: 12 });
  });
  it("refuses zero, negatives, decimals, junk and absurd sizes", () => {
    for (const raw of ["0", "-3", "4.5", "abc", "1001"]) {
      expect(parseCapacity(raw).error).toBeTruthy();
    }
  });
});

describe("signupStatus", () => {
  const base = {
    capacity: null as number | null,
    taken: 0,
    deadline: null as string | null,
    now: "2026-11-16T15:00:00.000Z",
    upcoming: true,
  };

  it("is open with no count for an uncapped event", () => {
    expect(signupStatus(base)).toEqual({ state: "open", spotsLeft: null });
  });

  it("reports spots left for a capped event", () => {
    expect(signupStatus({ ...base, capacity: 48, taken: 30 })).toEqual({
      state: "open",
      spotsLeft: 18,
    });
  });

  it("is full when every spot is taken (or over-taken after a cap cut)", () => {
    expect(signupStatus({ ...base, capacity: 48, taken: 48 })).toEqual({
      state: "full",
      spotsLeft: 0,
    });
    expect(signupStatus({ ...base, capacity: 10, taken: 14 })).toEqual({
      state: "full",
      spotsLeft: 0,
    });
  });

  it("is closed once the deadline has passed, even with room", () => {
    expect(
      signupStatus({
        ...base,
        capacity: 48,
        taken: 2,
        deadline: "2026-11-16T14:59:59.000Z",
      }),
    ).toEqual({ state: "closed", spotsLeft: 46 });
  });

  it("stays open right up to the deadline", () => {
    expect(
      signupStatus({ ...base, deadline: "2026-11-16T15:00:00.000Z" }).state,
    ).toBe("open");
  });

  it("is past once the event date has gone, regardless of anything else", () => {
    expect(signupStatus({ ...base, upcoming: false }).state).toBe("past");
  });
});

it("caps a party at the DB's check bound", () => {
  expect(MAX_EVENT_PARTY).toBe(20);
});
