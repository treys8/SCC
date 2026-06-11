"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelReservation } from "@/app/(app)/reservations/actions";

export function CancelReservationButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const keepRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // Native confirm() trapped focus; the inline reveal must hand it off, so land
  // keyboard focus on the safe "Keep" option rather than dropping it to <body>.
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  function confirmCancel() {
    setError(null);
    startTransition(async () => {
      try {
        await cancelReservation(id);
        setConfirming(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not cancel.");
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Cancel reservation"
        className="btn btn-ghost btn-sm text-muted hover:bg-danger/10 hover:text-danger"
      >
        Cancel
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">Cancel this?</span>
      <button
        ref={keepRef}
        type="button"
        onClick={() => {
          setConfirming(false);
          setError(null);
        }}
        disabled={pending}
        className="btn btn-ghost btn-sm"
      >
        Keep
      </button>
      <button
        type="button"
        onClick={confirmCancel}
        disabled={pending}
        className="btn btn-danger btn-sm"
      >
        {pending ? "Cancelling…" : "Confirm cancel"}
      </button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
