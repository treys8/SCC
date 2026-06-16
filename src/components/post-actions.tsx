"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePost, togglePin } from "@/app/(app)/posts/actions";

/**
 * Post kebab menu. Pin/unpin shows for staff (`canPin` — staff may pin any
 * post); edit and delete show for the author only (`isAuthor`). The parent only
 * renders this when at least one applies.
 */
export function PostActions({
  id,
  isPinned,
  isAuthor,
  canPin,
}: {
  id: string;
  isPinned: boolean;
  isAuthor: boolean;
  canPin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function pin() {
    setOpen(false);
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
    setOpen(false);
    if (!confirm("Delete this post? This can't be undone.")) return;
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full text-lg leading-none text-muted hover:bg-background disabled:opacity-50 sm:h-9 sm:w-9"
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-md"
        >
          {canPin && (
            <button
              type="button"
              role="menuitem"
              onClick={pin}
              className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-2"
            >
              {isPinned ? "Unpin" : "Pin to top"}
            </button>
          )}
          {canPin && (
            <Link
              role="menuitem"
              href={`/posts/new?from=${id}`}
              className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-2"
              onClick={() => setOpen(false)}
            >
              Use as template
            </Link>
          )}
          {isAuthor && (
            <Link
              role="menuitem"
              href={`/posts/${id}/edit`}
              className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-2"
              onClick={() => setOpen(false)}
            >
              Edit
            </Link>
          )}
          {isAuthor && (
            <button
              type="button"
              role="menuitem"
              onClick={remove}
              className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger/10"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
