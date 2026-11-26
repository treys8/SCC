import { formatLongDate } from "@/lib/format";
import type { Weather } from "@/lib/weather";

/**
 * The Today page's front door: a full-bleed deep-green band that continues the
 * site header. A gold dated eyebrow, a large light serif greeting with the
 * member's name in gold italic, the one-line concierge summary, and — from md
 * up — the temperature set big on the right like a printed masthead. (On
 * phones the weather folds into the eyebrow instead.)
 *
 * Like PageHeader it must be the page's first element; it uses the same
 * (50vw − 50%) breakout so it spans the viewport while its content stays on
 * the page column.
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
    <header className="band on-dark mx-[calc(50%-50vw)] bg-green-deep px-[calc(50vw-50%)] pt-10 pb-12 text-cream sm:pt-16 sm:pb-20">
      <div className="flex items-end justify-between gap-10">
        <div className="min-w-0">
          <p className="eyebrow text-gold-soft">
            {formatLongDate(dateISO)}
            {weather && (
              <span className="md:hidden">
                {" "}
                · {weather.tempF}° {weather.condition}
              </span>
            )}
          </p>
          <h1 className="text-display mt-5 text-cream">
            {greeting},{" "}
            <em className="font-normal whitespace-nowrap text-gold-soft italic">
              {firstName}.
            </em>
          </h1>
          <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-relaxed text-cream/75 sm:text-lg">
            {summary}
          </p>
        </div>
        {weather && (
          <div className="hidden shrink-0 border-l border-cream/15 pl-10 text-right md:block">
            <p className="font-serif text-[5.5rem] leading-[0.9] font-normal lg:text-8xl">
              {weather.tempF}
              <span className="align-top text-[0.45em] text-gold-soft">°</span>
            </p>
            <p className="mt-3 text-[0.7rem] font-semibold tracking-[0.18em] text-cream/60 uppercase">
              {weather.condition}
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
