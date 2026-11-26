"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavLink = { href: string; label: string };

export function NavLinks({
  links,
  className,
}: {
  links: NavLink[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex items-center gap-0.5", className)}>
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-3 py-2 text-[0.84rem] tracking-[0.03em] transition-colors",
              active
                ? "text-gold-soft after:absolute after:inset-x-3 after:-bottom-px after:h-px after:bg-gold-soft"
                : "text-cream/75 hover:text-cream",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
