import { formatLongDate } from "@/lib/format";
import type { Weather } from "@/lib/weather";

/**
 * The Today page's "front door" header: a dated eyebrow that folds in the
 * weather glance ("THURSDAY, JUNE 11 · 92° CLEAR"), a serif greeting by first
 * name, and a one-line concierge summary of the member's day.
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
    <header className="min-w-0">
      <p className="text-caption font-medium uppercase tracking-widest text-muted">
        {formatLongDate(dateISO)}
        {weather && ` · ${weather.tempF}° ${weather.condition}`}
      </p>
      <h1 className="mt-1.5 text-display text-foreground">
        {greeting}, {firstName}.
      </h1>
      <p className="mt-2 text-body text-muted">{summary}</p>
    </header>
  );
}
