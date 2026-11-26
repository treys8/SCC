import Link from "next/link";
import { Crest } from "@/components/crest";
import { MobileNav } from "@/components/mobile-nav";
import { NavLinks, type NavLink } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { UserMenu } from "@/components/user-menu";
import { isAdmin, isStaff } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";
import type { Profile } from "@/lib/database.types";

export function SiteNav({
  profile,
  unreadCount,
}: {
  profile: Profile;
  unreadCount: number;
}) {
  const links: NavLink[] = [
    // "/" is now the "Today at the Club" home for members and staff alike.
    { href: "/", label: "Today" },
    { href: "/posts", label: "Feed" },
    { href: "/reservations", label: "Reservations" },
    { href: "/calendar", label: "Calendar" },
    { href: "/dining", label: "Dining" },
    { href: "/pool", label: "Pool" },
    // Newsletters, forms, and menu/pool PDFs live in the document library.
    { href: "/documents", label: "Documents" },
  ];
  // Members reach the front office via Contact; staff have the inbox instead
  // (and don't need to message themselves), so it's member-only.
  if (!isStaff(profile.role)) {
    links.push({ href: "/contact", label: "Contact" });
  }
  // Staff tools live in their own group — the avatar menu on desktop and a
  // "Staff" section of the phone drawer — so the green bar keeps to the
  // member links and the one-line wordmark has room.
  const staffLinks: NavLink[] = [];
  if (isStaff(profile.role)) {
    staffLinks.push({ href: "/directory", label: "Directory" });
    staffLinks.push({ href: "/manage", label: "Manage" });
  }
  if (isAdmin(profile.role)) {
    staffLinks.push({ href: "/members", label: "Members" });
  }

  return (
    <header className="on-dark relative bg-green-deep text-cream">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 lg:py-4">
        <MobileNav
          links={links}
          staffLinks={staffLinks}
          fullName={profile.full_name}
          roleLabel={ROLE_LABEL[profile.role]}
        />

        {/* The wordmark never wraps. Between lg and xl the full link row needs
            the room, so the name steps aside and the crest carries the brand. */}
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Crest tone="dark" className="h-9 w-9" />
          <span className="hidden whitespace-nowrap font-serif text-lg tracking-[0.01em] text-cream sm:block lg:hidden xl:block">
            Starkville Country Club
          </span>
        </Link>

        <NavLinks links={links} className="ml-6 hidden lg:flex" />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-md text-cream/80 transition-colors hover:bg-cream/10 hover:text-cream sm:h-9 sm:w-9"
          >
            <SearchIcon />
          </Link>
          <NotificationBell count={unreadCount} />
          {/* Phones: a direct profile shortcut (the drawer covers sign-out). */}
          <Link
            href="/profile"
            aria-label="My profile"
            className="flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-cream/10 lg:hidden"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-soft text-sm font-semibold text-green-darker"
            >
              {initials(profile.full_name)}
            </span>
          </Link>
          {/* Desktop: avatar dropdown (Profile, Notifications, Sign out). */}
          <UserMenu
            fullName={profile.full_name}
            roleLabel={ROLE_LABEL[profile.role]}
            unreadCount={unreadCount}
            staffLinks={staffLinks}
            className="hidden lg:block"
          />
        </div>
      </div>
      {/* Gold hairline that fades in from the edges. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
      />
    </header>
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

function SearchIcon() {
  return (
    <svg
      aria-hidden
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
