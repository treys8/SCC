/**
 * Current conditions for the club, for the Today page's weather glance. Source
 * is Open-Meteo (free, no API key). The result is the same for every member, so
 * it's cached process-wide for 30 min via `unstable_cache` rather than re-fetched
 * per request — the Today page itself is dynamic (per-user auth), so we can't let
 * the page's render mode govern this. Failures return `null` so the section just
 * collapses, and errors are *not* cached (they throw past the cache and retry on
 * the next load) — only good readings stick for the TTL.
 */
import { unstable_cache } from "next/cache";
import { CLUB_COORDS, CLUB_TZ } from "@/lib/constants";

export type WeatherIcon =
  | "sun"
  | "partly"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm";

export type Weather = {
  /** Whole degrees Fahrenheit. */
  tempF: number;
  /** Human label, e.g. "Partly cloudy". */
  condition: string;
  /** Coarse category for picking an icon. */
  icon: WeatherIcon;
  /** Whole mph. */
  windMph: number;
  /** 16-point compass bearing the wind blows *from*, e.g. "WSW". */
  windDir: string;
};

/** WMO weather-interpretation codes → a label + coarse icon category. */
const WMO: Record<number, { label: string; icon: WeatherIcon }> = {
  0: { label: "Clear", icon: "sun" },
  1: { label: "Mainly clear", icon: "sun" },
  2: { label: "Partly cloudy", icon: "partly" },
  3: { label: "Overcast", icon: "cloud" },
  45: { label: "Fog", icon: "fog" },
  48: { label: "Freezing fog", icon: "fog" },
  51: { label: "Light drizzle", icon: "drizzle" },
  53: { label: "Drizzle", icon: "drizzle" },
  55: { label: "Heavy drizzle", icon: "drizzle" },
  56: { label: "Freezing drizzle", icon: "drizzle" },
  57: { label: "Freezing drizzle", icon: "drizzle" },
  61: { label: "Light rain", icon: "rain" },
  63: { label: "Rain", icon: "rain" },
  65: { label: "Heavy rain", icon: "rain" },
  66: { label: "Freezing rain", icon: "rain" },
  67: { label: "Freezing rain", icon: "rain" },
  71: { label: "Light snow", icon: "snow" },
  73: { label: "Snow", icon: "snow" },
  75: { label: "Heavy snow", icon: "snow" },
  77: { label: "Snow grains", icon: "snow" },
  80: { label: "Light showers", icon: "rain" },
  81: { label: "Showers", icon: "rain" },
  82: { label: "Heavy showers", icon: "rain" },
  85: { label: "Snow showers", icon: "snow" },
  86: { label: "Snow showers", icon: "snow" },
  95: { label: "Thunderstorm", icon: "storm" },
  96: { label: "Thunderstorm", icon: "storm" },
  99: { label: "Thunderstorm", icon: "storm" },
};

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function compass(deg: number): string {
  return COMPASS[Math.round(deg / 22.5) % 16];
}

async function load(): Promise<Weather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(CLUB_COORDS.lat));
  url.searchParams.set("longitude", String(CLUB_COORDS.lng));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,wind_speed_10m,wind_direction_10m",
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", CLUB_TZ);

  // `no-store` so the surrounding unstable_cache is the single source of TTL;
  // the timeout keeps a slow upstream from stalling the whole page render.
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);

  const c = (await res.json()).current;
  const wmo = WMO[Number(c.weather_code)] ?? { label: "—", icon: "cloud" as const };
  return {
    tempF: Math.round(c.temperature_2m),
    condition: wmo.label,
    icon: wmo.icon,
    windMph: Math.round(c.wind_speed_10m),
    windDir: compass(c.wind_direction_10m),
  };
}

const loadCached = unstable_cache(load, ["weather"], {
  revalidate: 1800,
  tags: ["weather"],
});

/** Current club weather, or `null` if the upstream is unreachable. */
export async function fetchWeather(): Promise<Weather | null> {
  try {
    return await loadCached();
  } catch {
    return null;
  }
}
