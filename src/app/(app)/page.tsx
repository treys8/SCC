import Link from "next/link";
import { BuffetCard } from "@/components/today/buffet-card";
import { DiningCard } from "@/components/today/dining-card";
import { ConditionsGrid } from "@/components/conditions-grid";
import { FacilityStatusWidget } from "@/components/facility-status-widget";
import { FeaturedCard } from "@/components/today/featured-card";
import { TodayEvents } from "@/components/today/today-events";
import { TodayHero } from "@/components/today/today-hero";
import { getProfile, isStaff } from "@/lib/auth";
import { CLUB_TZ } from "@/lib/constants";
import { fetchFacilityStatus } from "@/lib/facility";
import { formatTime, formatTimeRange } from "@/lib/format";
import { memberFirstName } from "@/lib/member";
import {
  fetchReservationSettings,
  fetchTodaysReservation,
  isStandingReservationDay,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import { fetchWeather, type Weather } from "@/lib/weather";
import type {
  CalendarEvent,
  DiningBuffet,
  FacilityStatus,
  FacilityStatusType,
  Reservation,
} from "@/lib/database.types";

/**
 * "Today at the Club" — a conditions-first front door, distinct from the Feed.
 * Top to bottom: a concierge hero, the Course & Pool conditions cards (the
 * focus), today's lunch buffet, the day's events, and a dinner-service note.
 * It's all live data: facility status + the conditions detail rows, the buffet
 * (both staff-set on /facility), events, weather, and dining hours.
 */
export default async function TodayPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  // "Today" must be the club's calendar day, not the server's. On Vercel the
  // server runs in UTC, which rolls to tomorrow at ~7 PM Central — right in the
  // middle of dinner service — so a server-local date would make tonight's
  // reservation vanish from the hero exactly when the member is sitting down.
  const { hour, minute, today, weekday } = clubNow();

  const [
    facilities,
    reservation,
    settings,
    todaysEventsRes,
    buffetRes,
    brunchRes,
    todayMenuRes,
    weather,
  ] = await Promise.all([
      fetchFacilityStatus(supabase),
      profile
        ? fetchTodaysReservation(supabase, profile.id, today)
        : Promise.resolve<Reservation | null>(null),
      fetchReservationSettings(supabase),
      supabase
        .from("calendar_events")
        .select("*")
        .eq("event_date", today)
        .order("start_time", { ascending: true }),
      supabase.from("dining_buffet").select("*").maybeSingle(),
      supabase.from("dining_brunch").select("*").maybeSingle(),
      supabase
        .from("buffet_week")
        // `main:dishes` needs the FK hint — the buffet_week_sides junction makes
        // a second (m2m) buffet_week↔dishes relationship, so the bare name is
        // ambiguous. `dish:dishes` under sides has one FK, so it's unambiguous.
        .select(
          "is_closed, main:dishes!buffet_week_main_dish_id_fkey(name), sides:buffet_week_sides(position, dish:dishes(name))",
        )
        .eq("weekday", weekday)
        .maybeSingle(),
      fetchWeather(),
    ]);

  const todaysEvents = todaysEventsRes.data ?? [];
  // The soonest event staff flagged as today's highlight gets the featured card;
  // todaysEvents is already ordered by start_time, so the first match is soonest.
  const featured = todaysEvents.find((e) => e.is_highlight) ?? null;
  // The featured event shows in the hero card, so drop it from the list below.
  const otherEvents = featured
    ? todaysEvents.filter((e) => e.id !== featured.id)
    : todaysEvents;
  const buffet = buffetRes.data;
  const brunch = brunchRes.data;
  // Today's weekday plan: the chef's main + sides for this day, and whether the
  // club is closed (no buffet today). The seven rows are seeded, so a missing
  // row just means "not closed, nothing chosen yet".
  const todayMenu = todayMenuRes.data;
  const buffetClosed = todayMenu?.is_closed ?? false;
  const buffetMain = todayMenu?.main?.name ?? null;
  const buffetSides = (todayMenu?.sides ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => s.dish?.name)
    .filter((n): n is string => Boolean(n));
  const firstName = (profile && memberFirstName(profile)) || "Member";

  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  // Dinner service is Fri/Sat only (and always reservations-required); brunch is
  // Sunday. Mon–Thu show no dinner/brunch card — just the lunch buffet on its days.
  const isDinnerNight = isStandingReservationDay(today);
  const isBrunchDay = weekday === 7;
  const brunchMeta = brunch
    ? [
        brunch.start_time && formatTimeRange(brunch.start_time, brunch.end_time),
        brunch.location,
        brunch.price,
      ]
        .filter(Boolean)
        .join(" · ") || null
    : null;
  const summary = conciergeSummary(
    reservation,
    weather,
    buffet,
    facilities,
    featured,
    today,
    hour * 60 + minute,
  );
  // Staff get the live, one-tap conditions editor right on the home screen
  // (quick on mobile); members see the read-only conditions cards.
  const canManage = profile ? isStaff(profile.role) : false;

  // A single full-width column, top to bottom: hero → featured → conditions
  // (a 2×2 tile grid on desktop, see ConditionsGrid) → today's dining services
  // → the day's events. Tighter vertical rhythm than the phone default.
  return (
    <div className="space-y-6 sm:space-y-8">
      <TodayHero
        firstName={firstName}
        dateISO={today}
        greeting={greeting}
        summary={summary}
        weather={weather}
      />
      {featured && <FeaturedCard event={featured} />}
      {canManage ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-h2 text-foreground">Conditions</h2>
            <Link
              href="/manage/conditions"
              className="shrink-0 text-sm font-medium text-accent-600"
            >
              Edit details →
            </Link>
          </div>
          <FacilityStatusWidget initial={facilities} canManage />
        </section>
      ) : (
        <ConditionsGrid facilities={facilities} />
      )}
      {buffet?.active && !buffetClosed && (
        <BuffetCard buffet={buffet} main={buffetMain} sides={buffetSides} />
      )}
      {isDinnerNight && (
        <DiningCard
          eyebrow="Tonight's dinner"
          title="Dinner service"
          meta={formatTimeRange(settings.service_start, settings.service_end)}
          reservation="required"
        />
      )}
      {isBrunchDay && brunch?.active && (
        <DiningCard
          eyebrow="Sunday brunch"
          title={brunch.title}
          meta={brunchMeta}
          description={brunch.description}
          reservation={brunch.walk_in ? "walk_in" : "required"}
        />
      )}
      {/* Show the events list unless the day's only event is the featured one —
          then a "nothing on the calendar" empty state under the hero would lie. */}
      {(otherEvents.length > 0 || !featured) && (
        <TodayEvents events={otherEvents} />
      )}
    </div>
  );
}

/** Wall-clock date + hour/minute in the club's timezone (not the server's). */
function clubNow(): {
  hour: number;
  minute: number;
  today: string;
  weekday: number;
} {
  // en-CA renders the date as YYYY-MM-DD, matching how dates are stored.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLUB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  // ISO weekday (1=Mon … 7=Sun) for the club's calendar day. Parse at noon UTC
  // so the date never rolls across a boundary.
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  // hour12:false can report "24" at midnight in some runtimes; normalize to 0.
  return {
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    today,
    weekday: ((dow + 6) % 7) + 1,
  };
}

/**
 * One warm line for the hero. Priority: the member's reservation, then the
 * lead (a golf hold trumps a generic weather line so we never call it "a fine
 * day for the course" while the course is held), then one trailing clause —
 * today's buffet (time-sensitive) ahead of a nod to the day's featured event.
 * Buffet/event clauses read from the real rows, so they can't contradict the
 * cards below.
 */
function conciergeSummary(
  reservation: Reservation | null,
  weather: Weather | null,
  buffet: DiningBuffet | null,
  facilities: FacilityStatus[],
  featuredEvent: CalendarEvent | null,
  todayISO: string,
  nowMinutes: number,
): string {
  if (reservation) {
    return reservation.status === "confirmed"
      ? "You've a table reserved for this evening — we'll see you tonight."
      : "Your table request for this evening is in — we'll confirm it shortly.";
  }

  const golf = facilities.find((f) => f.facility === "golf");
  const lead =
    (golf && GOLF_HOLD_LEAD[golf.status]) ??
    (weather ? weatherLead(weather, todayISO) : "A fine day at the club.");

  if (buffet?.active && buffet.end_time) {
    return `${lead} The ${buffet.title.toLowerCase()} runs 'til ${formatTime(
      buffet.end_time,
    )}.`;
  }
  // Only nudge toward the featured event while it's still ahead — the hero shows
  // all day, so "Don't miss …" mustn't point at something that already happened.
  if (featuredEvent && startMinutes(featuredEvent) >= nowMinutes) {
    const when = featuredEvent.start_time
      ? ` at ${formatTime(featuredEvent.start_time)}`
      : "";
    return `${lead} Don't miss ${featuredEvent.title}${when}.`;
  }
  return lead;
}

/** An event's start as minutes since midnight; -∞-ish guard if it's unset. */
function startMinutes(event: CalendarEvent): number {
  if (!event.start_time) return -1;
  const [h, m] = event.start_time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Honest opener when golf isn't open — it outranks the weather line. */
const GOLF_HOLD_LEAD: Partial<Record<FacilityStatusType, string>> = {
  frost_delay: "Frost on the greens — the course is on a brief hold for now.",
  rain_delay: "Rain's moving through — the course is on a hold for now.",
  lightning_hold: "Lightning in the area — play is on hold. Best stay in for now.",
  closed: "The course is closed today — but the rest of the club is open.",
};

/**
 * A conditions-led opener keyed off the coarse weather glyph, with 2–3 variants
 * per mood so the hero doesn't read identically every clear day. The variant is
 * picked deterministically from the club's date (see `dailyIndex`) — stable
 * through the day, different tomorrow. A clear-but-cold day gets its own bucket
 * so we don't promise "warming up" at 40°.
 */
function weatherLead(weather: Weather, todayISO: string): string {
  let bucket: keyof typeof WEATHER_LINES;
  switch (weather.icon) {
    case "sun":
    case "partly":
      bucket = weather.tempF < 55 ? "fairCool" : "fair";
      break;
    case "cloud":
    case "fog":
      bucket = "grey";
      break;
    case "drizzle":
    case "rain":
    case "storm":
      bucket = "wet";
      break;
    case "snow":
      bucket = "snow";
      break;
    default:
      // A future WeatherIcon shouldn't blank the hero line.
      return "A fine day at the club.";
  }
  const lines = WEATHER_LINES[bucket];
  return lines[dailyIndex(todayISO, lines.length)];
}

const WEATHER_LINES = {
  fair: [
    "Clear and warming up — a fine day for the course or the pool.",
    "Sunshine all day — the course and the pool are calling.",
    "Bright and mild — hard to beat for a round or a few laps.",
  ],
  fairCool: [
    "Clear but cool — a crisp one for the course; the pool can wait.",
    "Bright and brisk — worth a layer for the course this morning.",
  ],
  grey: [
    "Soft and overcast — an easy day on the grounds.",
    "Grey and calm — a quiet one around the club.",
  ],
  wet: [
    "Wet out there — best check conditions before you head over.",
    "Rain in the mix — worth a look at conditions before you come by.",
  ],
  snow: ["Cold and crisp — bundle up if you're coming by."],
} as const;

/**
 * Deterministic index in [0, n) seeded by the club's ISO date. Server-rendered,
 * so Math.random() is out (it'd differ per request and fight caching); hashing
 * the date keeps the pick stable through the day but varies it day to day.
 */
function dailyIndex(todayISO: string, n: number): number {
  let h = 0;
  for (let i = 0; i < todayISO.length; i++) {
    h = (h * 31 + todayISO.charCodeAt(i)) >>> 0;
  }
  return h % n;
}
