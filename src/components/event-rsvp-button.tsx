"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRsvp } from "@/app/(app)/calendar/actions";
import { cn } from "@/lib/cn";

/**
 * "I'm coming" for a club-run event. Optimistic: the toggle flips immediately
 * and rolls back if the server refuses — an RSVP isn't worth a spinner.
 *
 * Only rendered for events without a registration_url (GolfGenius handles its
 * own sign-ups) and only while the event is still ahead; the action re-checks
 * both, since neither is the client's call to make.
 */
export function EventRsvpButton({
  eventId,
  initialGoing,
}: {
  eventId: string;
  initialGoing: boolean;
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
        await setRsvp(eventId, next);
        router.refresh();
      } catch (e) {
        setGoing(!next); // put it back
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

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
