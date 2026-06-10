/**
 * "Add to calendar" helpers: a single-event .ics file and a Google Calendar
 * template URL. Times are emitted as floating local time (no TZID / no "Z")
 * since events are stored as wall-clock values — every member is in the
 * club's local timezone, so the wall-clock reading is what we want.
 */

import type { CalendarEvent, Reservation } from "@/lib/database.types";

/** Escape text per RFC 5545 (commas, semicolons, backslashes, newlines). */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "2026-06-07" + "18:30:00" -> "20260607T183000" */
function stamp(dateIso: string, time: string): string {
  const [y, m, d] = dateIso.split("-");
  const [hh = "00", mm = "00", ss = "00"] = time.split(":");
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}

/** Add one hour to "HH:MM[:SS]", clamped to 23:59 (no day rollover). */
function plusHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}:00`;
}

function endTimeOf(event: CalendarEvent): string {
  return event.end_time ?? plusHour(event.start_time);
}

/** UTC DTSTAMP ("20260607T120000Z") for "now". */
export function icsStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Filesystem-safe slug for the downloaded filename. */
export function eventSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}

/** A downloadable VCALENDAR string for one event. */
export function buildICS(event: CalendarEvent, dtstamp: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Starkville Country Club//Member Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@scc-portal`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${stamp(event.event_date, event.start_time)}`,
    `DTEND:${stamp(event.event_date, endTimeOf(event))}`,
    `SUMMARY:${esc(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${esc(event.description)}`);
  if (event.location) lines.push(`LOCATION:${esc(event.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n"; // RFC 5545 CRLF line endings
}

/** A dining reservation runs 90 min for calendar purposes (no end is stored). */
const RESERVATION_DURATION_MIN = 90;

/** Add minutes to "HH:MM[:SS]", clamped to 23:59 (no day rollover). */
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + (m || 0) + mins, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}:00`;
}

/**
 * A downloadable VCALENDAR string for a dining reservation. Universal (.ics
 * imports into Apple, Outlook, and Google alike), so the Today card needs only
 * one "Add to calendar" action. The reservation's time is carried here even
 * though the card itself never displays it.
 */
export function buildReservationICS(r: Reservation, dtstamp: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Starkville Country Club//Member Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:reservation-${r.id}@scc-portal`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${stamp(r.reservation_date, r.reservation_time)}`,
    `DTEND:${stamp(
      r.reservation_date,
      addMinutes(r.reservation_time, RESERVATION_DURATION_MIN),
    )}`,
    "SUMMARY:Dinner at Starkville Country Club",
    `DESCRIPTION:${esc(
      `Party of ${r.party_size}.${
        r.special_requests ? ` ${r.special_requests}` : ""
      }`,
    )}`,
    "LOCATION:Starkville Country Club",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n"; // RFC 5545 CRLF line endings
}

/** Google Calendar "create event" template URL. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const dates = `${stamp(event.event_date, event.start_time)}/${stamp(
    event.event_date,
    endTimeOf(event),
  )}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    ctz: "America/Chicago",
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
