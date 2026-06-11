import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { isAdmin, requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Manage" };

/**
 * Staff console home. A tile grid that gathers every staff task in one place —
 * some tiles open new console editors (/manage/*), others deep-link to existing
 * staff routes (post composer, calendar, members) that already work. Desktop is
 * the primary surface here; the most time-sensitive task (conditions) also lives
 * one tap away on the Today home for phones.
 */
type Tile = {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  adminOnly?: boolean;
};

const TILES: Tile[] = [
  {
    href: "/manage/conditions",
    title: "Conditions",
    description: "Golf, pool & tennis status, notes, and detail rows.",
    icon: <FlagIcon />,
  },
  {
    href: "/manage/messages",
    title: "Messages",
    description: "Member questions and requests sent from the Contact page.",
    icon: <MailIcon />,
  },
  {
    href: "/posts/new",
    title: "Post an update",
    description: "Announce news to the member feed, with photos or files.",
    icon: <MegaphoneIcon />,
  },
  {
    href: "/manage/documents",
    title: "Documents",
    description: "Publish menus, pool info, and newsletters to download.",
    icon: <DocIcon />,
  },
  {
    href: "/manage/dining",
    title: "Dining",
    description: "Today's lunch buffet card members see on the home page.",
    icon: <ForkIcon />,
  },
  {
    href: "/calendar/new",
    title: "Add an event",
    description: "Put a tournament, dinner, or social on the club calendar.",
    icon: <CalendarIcon />,
  },
  {
    href: "/manage/directory",
    title: "Staff directory",
    description: "Names, titles, and contact info on the Directory page.",
    icon: <PeopleIcon />,
  },
  {
    href: "/manage/club-info",
    title: "Club info",
    description: "Address and phone shown on Directory and the Contact page.",
    icon: <PinIcon />,
  },
  {
    href: "/members",
    title: "Members",
    description: "Invite members and manage roles.",
    icon: <KeyIcon />,
    adminOnly: true,
  },
];

export default async function ManagePage() {
  const profile = await requireRole("staff", "admin");
  const admin = isAdmin(profile.role);
  const tiles = TILES.filter((t) => !t.adminOnly || admin);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage"
        description="Update the club app — conditions, posts, menus, and more."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="card group flex items-start gap-4 p-5 transition-colors hover:bg-surface-2"
          >
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              {tile.icon}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-serif text-lg font-semibold text-foreground">
                {tile.title}
                <span
                  aria-hidden
                  className="text-muted transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                {tile.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

type IconProps = { className?: string };

function base(className = "h-5 w-5") {
  return {
    className,
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function FlagIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

function MailIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function MegaphoneIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l8 4V5L7 9H5a1 1 0 0 0-1 1Z" />
      <path d="M18 9a3 3 0 0 1 0 6" />
    </svg>
  );
}

function DocIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 2h8l4 4v16H6Z" />
      <path d="M14 2v4h4M9 13h6M9 17h6" />
    </svg>
  );
}

function ForkIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 3v8a3 3 0 0 0 6 0V3M8 3v18" />
      <path d="M17 3c-1.5 1-2 3-2 5s.5 3 2 3v10" />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

function PeopleIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
      <path d="M16 6a3 3 0 0 1 0 6M21 20c0-2.5-1.8-4.2-4-4.8" />
    </svg>
  );
}

function PinIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function KeyIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 8 8M16 16l2-2M19 19l2-2" />
    </svg>
  );
}
