import { NextEvent } from "@/components/today/next-event";
import { QuickActions } from "@/components/today/quick-actions";
import { StatusStrip } from "@/components/today/status-strip";
import { TodayHero } from "@/components/today/today-hero";
import { TonightCard } from "@/components/today/tonight-card";
import { getProfile } from "@/lib/auth";
import { CLUB_TZ } from "@/lib/constants";
import { fetchFacilityStatus } from "@/lib/facility";
import {
  fetchReservationSettings,
  fetchTodaysReservation,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import { fetchWeather } from "@/lib/weather";
import type { CalendarEvent, Reservation } from "@/lib/database.types";

/**
 * "Today at the Club" — a personalized front door, distinct from the Feed. Top
 * to bottom: a concierge hero, the member's own "Tonight" card, a quick-actions
 * launcher, a Golf/Pool/Dining status strip, and the single next event. It
 * shares data sources with the Feed but no UI: every piece here is bespoke.
 */
export default async function TodayPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  // "Today" must be the club's calendar day, not the server's. On Vercel the
  // server runs in UTC, which rolls to tomorrow at ~7 PM Central — right in the
  // middle of dinner service — so a server-local date would make tonight's
  // reservation vanish from the card exactly when the member is sitting down.
  const { hour, minute, today } = clubNow();

  const [facilities, reservation, settings, nextEventRes, weather] =
    await Promise.all([
      fetchFacilityStatus(supabase),
      profile
        ? fetchTodaysReservation(supabase, profile.id, today)
        : Promise.resolve<Reservation | null>(null),
      fetchReservationSettings(supabase),
      supabase
        .from("calendar_events")
        .select("*")
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle(),
      fetchWeather(),
    ]);

  const nextEvent = nextEventRes.data;
  const firstName = profile?.full_name.split(" ")[0] ?? "Member";

  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const diningOpen = isWithinService(
    hour * 60 + minute,
    settings.service_start,
    settings.service_end,
  );
  const summary = conciergeSummary(reservation, nextEvent, today);

  return (
    <div className="space-y-8 sm:space-y-10">
      <TodayHero
        firstName={firstName}
        dateISO={today}
        greeting={greeting}
        summary={summary}
        weather={weather}
      />
      <TonightCard reservation={reservation} settings={settings} />
      <QuickActions />
      <StatusStrip facilities={facilities} diningOpen={diningOpen} />
      {nextEvent && <NextEvent event={nextEvent} />}
    </div>
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

/** One warm line about the member's day for the hero (weather lives in the chip). */
function conciergeSummary(
  reservation: Reservation | null,
  nextEvent: CalendarEvent | null,
  today: string,
): string {
  if (reservation) {
    return reservation.status === "confirmed"
      ? "You've a table reserved for this evening — we'll see you tonight."
      : "Your table request for this evening is in — we'll confirm it shortly.";
  }
  if (nextEvent?.event_date === today) {
    return `${nextEvent.title} is happening at the club today.`;
  }
  return "Nothing booked today — the dining room's open for dinner from five.";
}
