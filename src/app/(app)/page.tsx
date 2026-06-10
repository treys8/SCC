import Link from "next/link";
import { BuffetCard } from "@/components/today/buffet-card";
import { ConditionsGrid } from "@/components/today/conditions-grid";
import { TodayEvents } from "@/components/today/today-events";
import { TodayHero } from "@/components/today/today-hero";
import { getProfile, isStaff } from "@/lib/auth";
import { CLUB_TZ } from "@/lib/constants";
import { fetchFacilityStatus } from "@/lib/facility";
import { formatTime } from "@/lib/format";
import {
  type BookingSettings,
  fetchReservationSettings,
  fetchTodaysReservation,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import { fetchWeather, type Weather, type WeatherIcon } from "@/lib/weather";
import type { DiningBuffet, Reservation } from "@/lib/database.types";

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
  const { hour, minute, today } = clubNow();

  const [facilities, reservation, settings, todaysEventsRes, buffetRes, weather] =
    await Promise.all([
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
      fetchWeather(),
    ]);

  const todaysEvents = todaysEventsRes.data ?? [];
  const buffet = buffetRes.data;
  const firstName = profile?.full_name.split(" ")[0] ?? "Member";

  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const diningOpen = isWithinService(
    hour * 60 + minute,
    settings.service_start,
    settings.service_end,
  );
  const summary = conciergeSummary(reservation, weather, buffet);

  return (
    <div className="space-y-8 sm:space-y-10">
      <TodayHero
        firstName={firstName}
        dateISO={today}
        greeting={greeting}
        summary={summary}
        weather={weather}
      />
      <ConditionsGrid
        facilities={facilities}
        canManage={profile ? isStaff(profile.role) : false}
      />
      {buffet?.active && <BuffetCard buffet={buffet} dateISO={today} />}
      <TodayEvents events={todaysEvents} />
      <DinnerNote settings={settings} diningOpen={diningOpen} />
    </div>
  );
}

/** The dinner-service footnote — real service hours, plus a path to booking. */
function DinnerNote({
  settings,
  diningOpen,
}: {
  settings: BookingSettings;
  diningOpen: boolean;
}) {
  return (
    <p className="flex items-center gap-2 border-t border-border pt-6 text-sm text-muted">
      <span aria-hidden>📅</span>
      <span>
        Dinner service runs{" "}
        <span className="font-medium text-foreground">
          {formatTime(settings.service_start)}–
          {formatTime(settings.service_end)}
        </span>
        {diningOpen ? " — we're seating now. " : " — "}
        <Link href="/reservations" className="font-medium text-accent-600">
          Reserve a table →
        </Link>
      </span>
    </p>
  );
}

/** Wall-clock date + hour/minute in the club's timezone (not the server's). */
function clubNow(): { hour: number; minute: number; today: string } {
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
  // hour12:false can report "24" at midnight in some runtimes; normalize to 0.
  return {
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    today: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/** Whether `nowMinutes` (since midnight) falls in [start, end) of "HH:MM[:SS]". */
function isWithinService(
  nowMinutes: number,
  start: string,
  end: string,
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  return nowMinutes >= toMin(start) && nowMinutes < toMin(end);
}

/**
 * One warm line for the hero — the member's reservation first, otherwise a
 * weather-led opener with a live nod to the buffet when one's on today. The
 * buffet clause reads from the real row (time + active), so it can't contradict
 * the card below it.
 */
function conciergeSummary(
  reservation: Reservation | null,
  weather: Weather | null,
  buffet: DiningBuffet | null,
): string {
  if (reservation) {
    return reservation.status === "confirmed"
      ? "You've a table reserved for this evening — we'll see you tonight."
      : "Your table request for this evening is in — we'll confirm it shortly.";
  }
  const lead = weather ? weatherLead(weather.icon) : "A fine day at the club.";
  if (buffet?.active && buffet.end_time) {
    return `${lead} The ${buffet.title.toLowerCase()} runs 'til ${formatTime(
      buffet.end_time,
    )}.`;
  }
  return lead;
}

/** A conditions-led opener keyed off the coarse weather glyph. */
function weatherLead(icon: WeatherIcon): string {
  switch (icon) {
    case "sun":
    case "partly":
      return "Clear and warming up — a fine day for the course or the pool.";
    case "cloud":
    case "fog":
      return "Soft and overcast — an easy day on the grounds.";
    case "drizzle":
    case "rain":
    case "storm":
      return "Wet out there — best check conditions before you head over.";
    case "snow":
      return "Cold and crisp — bundle up if you're coming by.";
    default:
      // A future WeatherIcon shouldn't blank the hero line.
      return "A fine day at the club.";
  }
}
