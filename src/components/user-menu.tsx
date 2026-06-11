"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/cn";

/**
 * Desktop avatar dropdown (md+). The trigger shows the member's name, role, and
 * an initials avatar; clicking opens a menu with My Profile, Notifications, and
 * Sign out — folding in what used to be a standalone top-bar sign-out button.
 *
 * On phones the hamburger drawer (mobile-nav.tsx) and bottom tab bar handle
 * navigation and sign-out, so this is rendered `hidden md:block` by SiteNav.
 *
 * Closes on outside-click (mirrors post-actions.tsx) and Escape, restoring focus
 * to the trigger. `signOut` is a server action used directly via a client form.
 */
export function UserMenu({
  fullName,
  roleLabel,
  unreadCount,
  className,
}: {
  fullName: string;
  roleLabel: string;
  unreadCount: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-right transition-colors hover:bg-background"
      >
        <span className="leading-tight">
          <span className="block text-sm font-medium text-foreground">
            {fullName}
          </span>
          <span className="block text-caption text-muted">{roleLabel}</span>
        </span>
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white"
        >
          {initials(fullName)}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-md"
        >
          <div className="border-b border-border px-4 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {fullName}
            </p>
            <p className="text-caption text-muted">{roleLabel}</p>
          </div>
          <Link
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
          >
            My Profile
          </Link>
          <Link
            role="menuitem"
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
          >
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-2xs font-semibold leading-none text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <form action={signOut} className="border-t border-border">
            <button
              role="menuitem"
              type="submit"
              className="block w-full px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
