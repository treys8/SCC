"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent } from "@/app/(app)/calendar/actions";

export function EventActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    if (!confirm("Delete this event?")) return;
    startTransition(async () => {
      try {
        await deleteEvent(id);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not delete event.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Link href={`/calendar/${id}/edit`} className="btn btn-ghost btn-sm">
        Edit
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="btn btn-ghost btn-sm text-danger hover:bg-danger/10"
      >
        Delete
      </button>
    </div>
  );
}
