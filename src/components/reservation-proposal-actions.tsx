"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptProposedTime,
  declineProposedTime,
} from "@/app/(app)/reservations/actions";

/**
 * Member-side response to the FOH manager's counter-offer: accept the proposed
 * slot in one tap (the reservation re-books + confirms) or decline it ("No
 * thanks"), which clears the offer and leaves the request declined.
 */
export function ReservationProposalActions({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: (id: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => run(acceptProposedTime)}
        disabled={pending}
        className="btn btn-primary btn-sm"
      >
        {pending ? "Working…" : "Accept new time"}
      </button>
      <button
        type="button"
        onClick={() => run(declineProposedTime)}
        disabled={pending}
        className="btn btn-ghost btn-sm text-muted"
      >
        No thanks
      </button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
