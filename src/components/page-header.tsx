import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The deep-green title band that opens every page, continuing the site header.
 *
 * It must be the FIRST element a page renders: the app layout gives `<main>` no
 * top padding, so the band sits flush under the header's gold hairline.
 *
 * Full-bleed without leaving the page's column: the band breaks out to the
 * viewport edges with a negative margin of (50vw − 50%) and pads back in by the
 * same amount, so its content box is exactly the parent's width. Narrow pages
 * (`mx-auto max-w-xl`, …) therefore get a title aligned with their own column.
 * The layout root clips horizontal overflow, because `100vw` includes the
 * desktop scrollbar.
 */
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
  back,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Small gold label above the title (e.g. "The club", a date). */
  eyebrow?: string;
  /** Optional return link shown above the title (detail pages). */
  back?: { href: string; label: string };
}) {
  return (
    <div className="band on-dark mx-[calc(50%-50vw)] mb-8! bg-green-deep px-[calc(50vw-50%)] pt-7 pb-9 text-cream sm:mb-10! sm:pt-10 sm:pb-12">
      {back && (
        <Link
          href={back.href}
          className="mb-5 inline-flex items-center gap-1.5 text-sm tracking-[0.03em] text-cream/70 transition-colors hover:text-cream"
        >
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-3 text-gold-soft">{eyebrow}</p>}
          <h1 className="text-h1 text-cream">{title}</h1>
          {description && (
            <p className="mt-2 max-w-[60ch] text-[0.95rem] leading-relaxed text-cream/70">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
