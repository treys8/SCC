import { DiningCard } from "@/components/today/dining-card";
import { formatTimeRange } from "@/lib/format";
import type { DiningBuffet } from "@/lib/database.types";

/**
 * "Today's buffet" — the lunch-buffet dining card, driven by the staff-editable
 * `dining_buffet` row (shared title/hours) plus the chef's weekday plan (`main`
 * + `sides`). A thin wrapper over the shared `DiningCard`. The page only renders
 * it when the buffet is active and the day isn't closed, so it assumes there's
 * something to show. `main`/`sides` are omitted when the chef hasn't set them.
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
    <DiningCard
      eyebrow="Today's buffet"
      title={buffet.title}
      meta={meta || null}
      mainDish={main}
      sides={sides}
      description={buffet.description}
      reservation={buffet.walk_in ? "walk_in" : null}
    />
  );
}
