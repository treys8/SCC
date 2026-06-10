import type { Weather, WeatherIcon } from "@/lib/weather";

/**
 * The Today page's weather glance: a compact card with the current temperature,
 * condition, and wind. Renders nothing when the reading is unavailable so the
 * section collapses cleanly.
 */
export function WeatherCard({ weather }: { weather: Weather | null }) {
  if (!weather) return null;

  return (
    <section className="card flex items-center gap-4 p-4 sm:p-5">
      <WeatherGlyph icon={weather.icon} />
      <div className="min-w-0">
        <p className="font-serif text-3xl font-semibold leading-none text-foreground">
          {weather.tempF}°
        </p>
        <p className="mt-1 text-sm text-muted">
          {weather.condition} · {weather.windMph} mph {weather.windDir}
        </p>
      </div>
    </section>
  );
}

function WeatherGlyph({ icon }: { icon: WeatherIcon }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-10 w-10 shrink-0 text-accent-600"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPHS[icon]}
    </svg>
  );
}

const SUN = (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>
);
const CLOUD = <path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 17 18H7z" />;

const GLYPHS: Record<WeatherIcon, React.ReactNode> = {
  sun: SUN,
  partly: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 2v1.5M3.2 3.2l1 1M2 8h1.5M13 8h.01" />
      <path d="M7 19a3.5 3.5 0 0 1 0-7 4.5 4.5 0 0 1 8.6-1.2A3 3 0 0 1 16 19H7z" />
    </>
  ),
  cloud: CLOUD,
  fog: (
    <>
      {CLOUD}
      <path d="M5 21h10M8 18.5h9" />
    </>
  ),
  drizzle: (
    <>
      {CLOUD}
      <path d="M9 20v1M13 20v1" />
    </>
  ),
  rain: (
    <>
      {CLOUD}
      <path d="M8 20l-1 2M12 20l-1 2M16 20l-1 2" />
    </>
  ),
  snow: (
    <>
      {CLOUD}
      <path d="M8 21h.01M12 21h.01M16 21h.01" />
    </>
  ),
  storm: (
    <>
      {CLOUD}
      <path d="M12 18l-2 4h3l-2 4" />
    </>
  ),
};
