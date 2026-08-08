"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRsvp } from "@/app/(app)/calendar/actions";
import { cn } from "@/lib/cn";

/**
 * "I'm coming" for a club-run event. Optimistic: the toggle flips immediately
 * and rolls back if the server refuses — an RSVP isn't worth a spinner.
 *
 * `canAdd` is false once an event has a registration_url (GolfGenius handles its
 * own sign-ups). Someone who answered before that link was added keeps a button
 * so they can withdraw, but it disappears once they do — re-adding is a refusal
 * the server would have to make. The action re-checks all of this; none of it is
 * the client's call.
 */
export function EventRsvpButton({
  eventId,
  initialGoing,
  canAdd,
}: {
  eventId: string;
  initialGoing: boolean;
  canAdd: boolean;
}) {
  const [going, setGoing] = useState(initialGoing);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !going;
    setGoing(next);
    setError(null);
    startTransition(async () => {
      try {
        const { error: refusal } = await setRsvp(eventId, next);
        if (refusal) {
          setGoing(!next); // put it back
          setError(refusal);
          return;
        }
        router.refresh();
      } catch {
        // Transport or auth failure — the refusals above come back as values.
        setGoing(!next);
        setError("Couldn't save that.");
      }
    });
  }

  // Withdraw-only and already withdrawn: nothing left to offer.
  if (!canAdd && !going) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={going}
        className={cn("btn btn-sm", going ? "btn-primary" : "btn-outline")}
      >
        {going ? "✓ You're coming" : "I'm coming"}
      </button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
