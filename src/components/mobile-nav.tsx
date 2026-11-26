"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavLink } from "@/components/nav-links";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/cn";

/**
 * Mobile-only header menu. The desktop nav links are `hidden lg:flex`, and the
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
  staffLinks = [],
  fullName,
  roleLabel,
}: {
  links: NavLink[];
  staffLinks?: NavLink[];
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
    <div className="lg:hidden">
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        className="-ml-2 flex h-11 w-11 items-center justify-center rounded-md text-cream/85 hover:bg-cream/10 hover:text-cream"
      >
        <MenuIcon />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-green-darker/50 animate-[overlay-in_150ms_ease-out] motion-reduce:animate-none"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="on-dark fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-green-deep text-cream shadow-2xl animate-[drawer-in_200ms_ease-out] motion-reduce:animate-none"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-cream/10 p-5">
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-serif text-xl text-cream">
                  {fullName}
                </span>
                <span className="mt-1 block text-[0.68rem] font-semibold tracking-[0.18em] text-gold-soft uppercase">
                  {roleLabel}
                </span>
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-2xl leading-none text-cream/70 hover:bg-cream/10"
              >
                ×
              </button>
            </div>

            <nav className="flex flex-col gap-0.5 p-3">
              {/* Search isn't in the shared `links` (desktop uses a header icon
                  instead of a text link), so add it explicitly here. */}
              <Link
                href="/search"
                onClick={() => setOpen(false)}
                aria-current={
                  pathname.startsWith("/search") ? "page" : undefined
                }
                className={drawerLink(pathname.startsWith("/search"))}
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
                    className={drawerLink(active)}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {staffLinks.length > 0 && (
                <>
                  <p className="mt-4 px-3 pb-1 text-[0.65rem] font-semibold tracking-[0.18em] text-gold-soft/80 uppercase">
                    Staff
                  </p>
                  {staffLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={
                        pathname.startsWith(link.href) ? "page" : undefined
                      }
                      className={drawerLink(pathname.startsWith(link.href))}
                    >
                      {link.label}
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <form action={signOut} className="mt-auto border-t border-cream/10 p-4">
              <button
                type="submit"
                className="btn w-full border border-cream/25 text-cream hover:bg-cream/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

/** Drawer row: serif-free, roomy; active gets a gold rule on the left. */
function drawerLink(active: boolean) {
  return cn(
    "flex min-h-11 items-center rounded-md border-l-2 px-3 text-[0.95rem] transition-colors",
    active
      ? "border-gold-soft bg-cream/[0.06] text-gold-soft"
      : "border-transparent text-cream/85 hover:bg-cream/[0.06] hover:text-cream",
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
