"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  joinEventWaitlist,
  leaveEventWaitlist,
  setRsvp,
} from "@/app/(app)/calendar/actions";
import { MAX_EVENT_PARTY, spotsLeftLabel, type SignupState } from "@/lib/events";

/**
 * Sign-up control for a club-run event: party size, "I'm coming", and — on a
 * capped event that can't fit the party — "Join the waitlist".
 *
 * Not optimistic: with spots, a waitlist and a deadline in play, the server's
 * answer (often "Only 2 spots left") is the thing worth showing, so each tap
 * waits for it and then refreshes the page's counts.
 *
 * `canAdd` is false once an event has a registration_url (GolfGenius handles its
 * own sign-ups). Someone who answered before that keeps a way to withdraw. The
 * actions and the database re-check everything; none of this is the client's call.
 */
export function EventRsvpButton({
  eventId,
  goingParty,
  waitlistParty,
  canAdd,
  state,
  spotsLeft,
}: {
  eventId: string;
  /** The member's RSVP party size, or null if not signed up. */
  goingParty: number | null;
  /** The member's waitlist party size, or null if not waiting. */
  waitlistParty: number | null;
  canAdd: boolean;
  state: SignupState;
  /** Null for an uncapped event. */
  spotsLeft: number | null;
}) {
  const [party, setParty] = useState(goingParty ?? waitlistParty ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      try {
        const { error: refusal } = await action();
        if (refusal) {
          setError(refusal);
          return;
        }
        router.refresh();
      } catch {
        // Transport or auth failure — refusals come back as values.
        setError("Couldn't save that.");
      }
    });
  }

  const going = goingParty != null;
  const closed = state === "closed" || state === "past";

  // Spots available to *this* member: their own seats count as theirs when
  // resizing an existing RSVP.
  const room = spotsLeft == null ? null : spotsLeft + (goingParty ?? 0);
  const needsWaitlist = room != null && party > room;

  const partyPicker = (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      Party of
      <select
        className="select w-auto py-1"
        value={party}
        disabled={pending}
        onChange={(e) => setParty(Number(e.target.value))}
      >
        {Array.from({ length: MAX_EVENT_PARTY }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );

  let body: React.ReactNode;
  if (going) {
    const changed = party !== goingParty;
    // After the deadline a member may shrink their party but not grow it.
    const growBlocked = closed && party > goingParty;
    body = (
      <>
        <span className="btn btn-sm btn-primary pointer-events-none">
          ✓ You&rsquo;re coming
        </span>
        {partyPicker}
        {changed && !growBlocked && !needsWaitlist && (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={pending}
            onClick={() => run(() => setRsvp(eventId, true, party))}
          >
            Update party
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={pending}
          onClick={() => run(() => setRsvp(eventId, false))}
        >
          Can&rsquo;t make it
        </button>
      </>
    );
  } else if (waitlistParty != null) {
    body = (
      <>
        <span className="text-sm text-foreground">
          You&rsquo;re on the waitlist · party of {waitlistParty}
        </span>
        {!closed && !needsWaitlist && room != null && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={pending}
            onClick={() => run(() => setRsvp(eventId, true, waitlistParty))}
          >
            Take the spot
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={pending}
          onClick={() => run(() => leaveEventWaitlist(eventId))}
        >
          Leave waitlist
        </button>
      </>
    );
  } else if (!canAdd) {
    return null;
  } else if (closed) {
    body = <span className="text-sm text-muted">Sign-ups closed.</span>;
  } else {
    body = (
      <>
        {partyPicker}
        {needsWaitlist ? (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={pending}
            onClick={() => run(() => joinEventWaitlist(eventId, party))}
          >
            Join the waitlist
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={pending}
            onClick={() => run(() => setRsvp(eventId, true, party))}
          >
            I&rsquo;m coming
          </button>
        )}
      </>
    );
  }

  return (
    <div className="space-y-2">
      {spotsLeft != null && state !== "past" && (
        <p className="text-sm font-medium text-foreground">
          {spotsLeft === 0 ? "Full" : spotsLeftLabel(spotsLeft)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">{body}</div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
