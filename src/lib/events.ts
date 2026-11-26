/**
 * Pure sign-up rules for club-run events (capacity, deadline, waitlist). The
 * database is the real boundary — enforce_event_rsvp() refuses an over-cap or
 * after-deadline write no matter what the UI shows — these only decide what to
 * offer and what to say.
 */

/** Mirrors the event_rsvps / event_waitlist party_size check (1–20). */
export const MAX_EVENT_PARTY = 20;
/** Mirrors calendar_events_capacity_check. */
export const MAX_EVENT_CAPACITY = 1000;

/** Parse the staff "Capacity" field. Blank = no limit. */
export function parseCapacity(raw: string): { value: number | null; error?: string } {
  const s = raw.trim();
  if (s === "") return { value: null };
  if (!/^\d+$/.test(s)) {
    return { value: null, error: "Capacity must be a whole number of people." };
  }
  const n = Number(s);
  if (n < 1 || n > MAX_EVENT_CAPACITY) {
    return {
      value: null,
      error: `Capacity must be between 1 and ${MAX_EVENT_CAPACITY}.`,
    };
  }
  return { value: n };
}

export type SignupState = "open" | "full" | "closed" | "past";

/**
 * Where an event's sign-ups stand. `spotsLeft` is null for an uncapped event
 * (there's no number to show) and never negative — a capacity lowered below
 * the current headcount just reads as full.
 *
 * Precedence: past > closed (deadline) > full > open. A closed event with room
 * still reports its spotsLeft so staff can see it; members just can't take one.
 */
export function signupStatus(input: {
  capacity: number | null;
  taken: number;
  /** signup_deadline as a UTC ISO instant, or null. */
  deadline: string | null;
  /** Current instant, UTC ISO. */
  now: string;
  /** Event date is today or later (club time). */
  upcoming: boolean;
}): { state: SignupState; spotsLeft: number | null } {
  const spotsLeft =
    input.capacity == null ? null : Math.max(0, input.capacity - input.taken);
  if (!input.upcoming) return { state: "past", spotsLeft };
  if (input.deadline && Date.parse(input.now) > Date.parse(input.deadline)) {
    return { state: "closed", spotsLeft };
  }
  if (spotsLeft === 0) return { state: "full", spotsLeft };
  return { state: "open", spotsLeft };
}

/** "18 spots left" / "1 spot left". */
export function spotsLeftLabel(n: number): string {
  return `${n} ${n === 1 ? "spot" : "spots"} left`;
}
