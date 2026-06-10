import Link from "next/link";
import { Crest } from "@/components/crest";
import { NavLinks, type NavLink } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { signOut } from "@/lib/actions/auth";
import { isAdmin } from "@/lib/auth";
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
  ];
  if (isAdmin(profile.role)) {
    links.push({ href: "/members", label: "Members" });
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Crest className="h-9 w-9" />
          <span className="hidden font-serif text-lg font-semibold leading-tight text-primary sm:block">
            Starkville Country Club
          </span>
        </Link>

        <NavLinks links={links} className="ml-4 hidden md:flex" />

        <div className="ml-auto flex items-center gap-3">
          <NotificationBell count={unreadCount} />
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-md px-2 py-1 text-right hover:bg-background"
          >
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-medium text-foreground">
                {profile.full_name}
              </span>
              <span className="block text-caption text-muted">
                {ROLE_LABEL[profile.role]}
              </span>
            </span>
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white"
            >
              {initials(profile.full_name)}
            </span>
          </Link>
          <form action={signOut}>
            <button type="submit" className="btn btn-outline btn-sm">
              Sign out
            </button>
          </form>
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
