"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/cn";
import type { NavLink } from "@/components/nav-links";

/**
 * Desktop avatar dropdown (lg+). The trigger is a gold initials avatar on the
 * green header band; clicking opens a menu with the member's name, My Profile,
 * Notifications, a "Staff" group for staff/admin tools, and Sign out.
 *
 * On phones the hamburger drawer (mobile-nav.tsx) and bottom tab bar handle
 * navigation and sign-out, so this is rendered `hidden lg:block` by SiteNav.
 *
 * Closes on outside-click (mirrors post-actions.tsx) and Escape, restoring focus
 * to the trigger. `signOut` is a server action used directly via a client form.
 */
export function UserMenu({
  fullName,
  roleLabel,
  unreadCount,
  staffLinks = [],
  className,
}: {
  fullName: string;
  roleLabel: string;
  unreadCount: number;
  /** Staff/admin tools (Directory, Manage, Members), shown as a "Staff" group. */
  staffLinks?: NavLink[];
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
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-cream/10"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-soft text-sm font-semibold text-green-darker"
        >
          {initials(fullName)}
        </span>
        <span className="sr-only">
          {fullName}, {roleLabel} — account menu
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-cream/70 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-lg border border-border bg-surface py-1 text-foreground shadow-[0_18px_40px_-18px_rgba(21,42,27,0.45)]"
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
          {staffLinks.length > 0 && (
            <div className="border-t border-border pt-1">
              <p className="eyebrow px-4 pt-2 pb-1 text-[0.65rem]">Staff</p>
              {staffLinks.map((link) => (
                <Link
                  key={link.href}
                  role="menuitem"
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
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
