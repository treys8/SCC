import Link from "next/link";

/**
 * One dining service on the Today page — the shared shell behind the lunch
 * buffet, Fri/Sat dinner, and Sunday brunch cards. A compact horizontal card:
 * solid-gold utensils thumbnail + details, a gold eyebrow in place of a section
 * heading (like the featured "Tonight" card). The page only renders it when
 * there's a service on, so it assumes there's something to show. `mainDish`/
 * `sides` are the chef's structured plan (lunch only); `description` is the
 * free-text blurb. `reservation` drives the closing line:
 *   "walk_in"  → ✓ Walk-in, no reservation needed
 *   "required" → Reservations required + a Reserve button
 *   null       → nothing
 */
export function DiningCard({
  eyebrow,
  title,
  meta = null,
  description = null,
  mainDish = null,
  sides = [],
  reservation = null,
}: {
  eyebrow: string;
  title: string;
  meta?: string | null;
  description?: string | null;
  mainDish?: string | null;
  sides?: string[];
  reservation?: "walk_in" | "required" | null;
}) {
  return (
    <div className="card flex gap-4 overflow-hidden p-3 sm:p-4">
      <div
        className="flex w-20 shrink-0 items-center justify-center rounded-lg bg-accent text-white sm:w-24"
        aria-hidden
      >
        <UtensilsGlyph />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-caption font-semibold uppercase tracking-wide text-accent-600">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-h2 text-foreground">{title}</h3>
        {meta && <p className="mt-0.5 text-sm text-muted">{meta}</p>}
        {mainDish && (
          <p className="mt-1.5 text-sm font-medium text-foreground">{mainDish}</p>
        )}
        {sides.length > 0 && (
          <p className="mt-0.5 text-sm text-muted">{sides.join(" · ")}</p>
        )}
        {description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted">{description}</p>
        )}
        {reservation === "walk_in" && (
          <p className="mt-1.5 text-sm font-medium text-success">
            ✓ Walk-in — no reservation needed
          </p>
        )}
        {reservation === "required" && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-sm font-medium text-foreground">
              Reservations required
            </span>
            <Link href="/reservations" className="btn btn-primary btn-sm">
              Reserve a table
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** A fork-and-knife glyph for the thumbnail (inline SVG, matching house style). */
function UtensilsGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}
