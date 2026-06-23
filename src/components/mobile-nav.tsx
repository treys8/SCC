"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavLink } from "@/components/nav-links";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/cn";

/**
 * Mobile-only header menu. The desktop nav links are `hidden md:flex`, and the
 * bottom tab bar only covers Today/Feed/Reserve/Calendar/Profile — so on a phone
 * the role-only routes (Facility, Members) have no entry point. This hamburger
 * opens a right slide-in drawer with the full role-aware link list plus sign-out.
 *
 * `SiteNav` stays a server component and passes the already-resolved links and
 * profile strings; `signOut` is a server action imported directly into this
 * client file and used via `<form action={signOut}>`.
 */
export function MobileNav({
  links,
  fullName,
  roleLabel,
}: {
  links: NavLink[];
  fullName: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape, lock background scroll, and focus the close button while
  // open; restore focus to the hamburger on close. Mirrors lightbox.tsx.
  useEffect(() => {
    if (!open) return;
    const opener = openButtonRef.current;
    closeButtonRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        className="flex h-11 w-11 items-center justify-center rounded-md text-foreground hover:bg-background"
      >
        <MenuIcon />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-foreground/40 animate-[overlay-in_150ms_ease-out] motion-reduce:animate-none"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-l border-border bg-surface shadow-xl animate-[drawer-in_200ms_ease-out] motion-reduce:animate-none"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-medium text-foreground">
                  {fullName}
                </span>
                <span className="block text-caption text-muted">{roleLabel}</span>
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-2xl leading-none text-muted hover:bg-background"
              >
                ×
              </button>
            </div>

            <nav className="flex flex-col gap-1 p-3">
              {/* Search isn't in the shared `links` (desktop uses a header icon
                  instead of a text link), so add it explicitly here. */}
              <Link
                href="/search"
                onClick={() => setOpen(false)}
                aria-current={
                  pathname.startsWith("/search") ? "page" : undefined
                }
                className={cn(
                  "flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors",
                  pathname.startsWith("/search")
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-background",
                )}
              >
                Search
              </Link>
              {links.map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-background",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <form action={signOut} className="mt-auto border-t border-border p-3">
              <button type="submit" className="btn btn-outline w-full">
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}
