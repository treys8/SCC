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
  // Staff get the directory and management console; admins additionally get Members.
  if (isStaff(profile.role)) {
    links.push({ href: "/directory", label: "Directory" });
    links.push({ href: "/manage", label: "Manage" });
  }
  if (isAdmin(profile.role)) {
    links.push({ href: "/members", label: "Members" });
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <MobileNav
          links={links}
          fullName={profile.full_name}
          roleLabel={ROLE_LABEL[profile.role]}
        />

        <Link href="/" className="flex items-center gap-2.5">
          <Crest className="h-9 w-9" />
          <span className="hidden font-serif text-lg font-semibold leading-tight text-primary sm:block">
            Starkville Country Club
          </span>
        </Link>

        <NavLinks links={links} className="ml-4 hidden md:flex" />

        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/search"
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-background"
          >
            <SearchIcon />
          </Link>
          <NotificationBell count={unreadCount} />
          {/* Phones: a direct profile shortcut (the drawer covers sign-out). */}
          <Link
            href="/profile"
            aria-label="My profile"
            className="flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-background md:hidden"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white"
            >
              {initials(profile.full_name)}
            </span>
          </Link>
          {/* Desktop: avatar dropdown (Profile, Notifications, Sign out). */}
          <UserMenu
            fullName={profile.full_name}
            roleLabel={ROLE_LABEL[profile.role]}
            unreadCount={unreadCount}
            className="hidden md:block"
          />
        </div>
      </div>
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
