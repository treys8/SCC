import { formatTimeRange } from "@/lib/format";
import type { DiningBuffet } from "@/lib/database.types";

/**
 * "Today's lunch buffet" — a compact horizontal card (gold utensils thumbnail +
 * details) driven by the staff-editable `dining_buffet` row. The page only
 * renders this when the buffet is active, so this component can assume there's
 * something to show. The weekday in the tag tracks the real date; everything
 * else is live data.
 */
export function BuffetCard({
  buffet,
  dateISO,
}: {
  buffet: DiningBuffet;
  dateISO: string;
}) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
  });

  const meta = [
    buffet.start_time && formatTimeRange(buffet.start_time, buffet.end_time),
    buffet.location,
    buffet.price,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="space-y-3">
      <h2 className="text-h2 text-foreground">Today&apos;s lunch buffet</h2>

      <div className="card flex gap-4 overflow-hidden p-3 sm:p-4">
        <div
          className="flex w-20 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-600 sm:w-24"
          aria-hidden
        >
          <UtensilsGlyph />
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <span className="badge bg-accent/10 uppercase tracking-wide text-accent-600">
            {weekday} · Dining
          </span>
          <h3 className="mt-1.5 text-h2 text-foreground">{buffet.title}</h3>
          {meta && <p className="mt-0.5 text-sm text-muted">{meta}</p>}
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
    </section>
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
