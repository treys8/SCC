"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelReservation } from "@/app/(app)/reservations/actions";

export function CancelReservationButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function cancel() {
    if (!confirm("Cancel this reservation?")) return;
    startTransition(async () => {
      try {
        await cancelReservation(id);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not cancel.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={cancel}
      disabled={pending}
      className="btn btn-ghost btn-sm text-danger hover:bg-danger/10"
    >
      Cancel
    </button>
  );
}
