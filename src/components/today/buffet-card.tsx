import { formatTimeRange } from "@/lib/format";
import type { DiningBuffet } from "@/lib/database.types";

/**
 * "Today's buffet" — a compact horizontal card (solid-gold utensils thumbnail +
 * details) driven by the staff-editable `dining_buffet` row (shared title/hours)
 * plus the chef's weekday plan (`main` + `sides`). Like the featured "Tonight"
 * card, it's a heading-less hero card: the gold "Today's buffet" eyebrow labels
 * it, so there's no outer section heading. The page only renders it when the
 * buffet is active and the day isn't closed, so it assumes there's something to
 * show. `main`/`sides` are omitted when the chef hasn't set them.
 */
export function BuffetCard({
  buffet,
  main = null,
  sides = [],
}: {
  buffet: DiningBuffet;
  main?: string | null;
  sides?: string[];
}) {
  const meta = [
    buffet.start_time && formatTimeRange(buffet.start_time, buffet.end_time),
    buffet.location,
    buffet.price,
  ]
    .filter(Boolean)
    .join(" · ");

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
          Today&apos;s buffet
        </p>
        <h3 className="mt-1 text-h2 text-foreground">{buffet.title}</h3>
        {meta && <p className="mt-0.5 text-sm text-muted">{meta}</p>}
        {main && (
          <p className="mt-1.5 text-sm font-medium text-foreground">{main}</p>
        )}
        {sides.length > 0 && (
          <p className="mt-0.5 text-sm text-muted">{sides.join(" · ")}</p>
        )}
        {buffet.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted">
            {buffet.description}
          </p>
        )}
        {buffet.walk_in && (
          <p className="mt-1.5 text-sm font-medium text-success">
            ✓ Walk-in — no reservation needed
          </p>
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
