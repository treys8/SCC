import { ConditionsChip } from "@/components/today/conditions-chip";
import { formatLongDate } from "@/lib/format";
import type { Weather } from "@/lib/weather";

/**
 * The Today page's "front door" header: a dated eyebrow, a serif greeting by
 * first name, a one-line concierge summary of the member's day, and an optional
 * conditions chip. Stacks on phones; greeting and chip sit on one row from sm up.
 */
export function TodayHero({
  firstName,
  dateISO,
  greeting,
  summary,
  weather,
}: {
  firstName: string;
  dateISO: string;
  greeting: string;
  summary: string;
  weather: Weather | null;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-caption font-medium uppercase tracking-widest text-muted">
          {formatLongDate(dateISO)}
        </p>
        <h1 className="mt-1.5 text-display text-foreground">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-2 text-body text-muted">{summary}</p>
      </div>
      {weather && <ConditionsChip weather={weather} />}
    </header>
  );
}
