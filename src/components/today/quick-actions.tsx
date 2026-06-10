import Link from "next/link";

/**
 * Four large tap targets — the page's launcher. Two dining-led actions, plus
 * jumps to the calendar and the feed. Golf is intentionally absent: there's no
 * tee-time booking, so the course shows up only in the status strip. Wraps to
 * 2×2 on phones, a single row of four from sm up.
 */
type Action = {
  href: string;
  label: string;
  icon: () => React.ReactNode;
};

const ACTIONS: Action[] = [
  { href: "/reservations", label: "Reserve a table", icon: TableIcon },
  { href: "/posts?dept=dining", label: "Tonight's menu", icon: MenuIcon },
  { href: "/calendar", label: "What's on", icon: CalendarIcon },
  { href: "/posts", label: "Browse the feed", icon: FeedIcon },
];

export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.label}
            href={action.href}
            className="flex min-h-28 flex-col items-center justify-center gap-2.5 rounded-xl border border-border bg-surface p-4 text-center shadow-sm transition-colors hover:bg-surface-2 active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon />
            </span>
            <span className="text-sm font-medium text-foreground">
              {action.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function svg(children: React.ReactNode) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function TableIcon() {
  return svg(
    <>
      <path d="M3 9h18" />
      <path d="M4 9V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
      <path d="M5 9v10M19 9v10M9 9v4M15 9v4" />
    </>,
  );
}

function MenuIcon() {
  return svg(
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>,
  );
}

function CalendarIcon() {
  return svg(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>,
  );
}

function FeedIcon() {
  return svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h7M7 13h10M7 17h6" />
    </>,
  );
}
