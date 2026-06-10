import { formatTimeRange } from "@/lib/format";
import type { DiningBuffet } from "@/lib/database.types";

/**
 * "Today's lunch buffet" — a featured dining card with an accent rail, driven by
 * the staff-editable `dining_buffet` row. The page only renders this when the
 * buffet is active, so this component can assume there's something to show. The
 * weekday in the tag tracks the real date; everything else is live data.
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

      <div className="card flex overflow-hidden">
        <div className="w-1.5 shrink-0 bg-accent" aria-hidden />
        <div className="flex-1 p-5 sm:p-6">
          <span className="badge bg-accent/10 uppercase tracking-wide text-accent-600">
            {weekday} · Dining
          </span>
          <h3 className="mt-2.5 text-h2 text-foreground">{buffet.title}</h3>
          {meta && <p className="mt-1 text-sm text-muted">{meta}</p>}
          {buffet.description && (
            <p className="mt-2 text-sm text-muted">{buffet.description}</p>
          )}
          {buffet.walk_in && (
            <p className="mt-3 text-sm font-medium text-success">
              ✓ Walk-in — no reservation needed
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
