"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveWaitlist } from "@/app/(app)/reservations/actions";

/**
 * Drop off the waitlist for a seating. No confirm step, unlike cancelling a real
 * reservation — nothing is given up that can't be re-joined in a tap.
 */
export function LeaveWaitlistButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function leave() {
    setError(null);
    startTransition(async () => {
      try {
        await leaveWaitlist(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not leave the waitlist.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={leave}
        disabled={pending}
        className="btn btn-ghost btn-sm text-muted hover:bg-danger/10 hover:text-danger"
      >
        {pending ? "Leaving…" : "Leave the waitlist"}
      </button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
