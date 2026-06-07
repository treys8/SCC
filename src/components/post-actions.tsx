"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePost, togglePin } from "@/app/(app)/posts/actions";

export function PostActions({
  id,
  isPinned,
}: {
  id: string;
  isPinned: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function pin() {
    startTransition(async () => {
      try {
        await togglePin(id, !isPinned);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not update pin.");
      }
    });
  }

  function remove() {
    if (!confirm("Delete this announcement?")) return;
    startTransition(async () => {
      try {
        await deletePost(id);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not delete.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={pin}
        disabled={pending}
        className="btn btn-ghost btn-sm"
      >
        {isPinned ? "Unpin" : "Pin"}
      </button>
      <Link href={`/posts/${id}/edit`} className="btn btn-ghost btn-sm">
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
