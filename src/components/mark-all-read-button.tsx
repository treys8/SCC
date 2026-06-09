"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/app/(app)/notifications/actions";

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await markAllNotificationsRead();
            router.refresh();
          } catch (e) {
            alert(e instanceof Error ? e.message : "Could not update.");
          }
        })
      }
      className="btn btn-ghost btn-sm"
    >
      Mark all as read
    </button>
  );
}
