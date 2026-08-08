import { describe, expect, it } from "vitest";
import { buildICS, buildReservationICS, eventSlug, googleCalendarUrl, icsStamp } from "./ics";
import type { CalendarEvent, Reservation } from "./database.types";

/**
 * Calendar export. Times are floating local by design (see the module header),
 * so what's asserted here is the wall-clock reading, never an offset.
 */

const DTSTAMP = "20260601T120000Z";

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    title: "Member-Guest Tournament",
    description: null,
    event_date: "2026-06-07",
    start_time: "18:30:00",
    end_time: null,
    location: null,
    department: null,
    registration_url: null,
    fee: null,
    schedule_note: null,
    cover_image_url: null,
    is_highlight: false,
    created_by: null,
    created_at: "2026-06-01T12:00:00Z",
    ...overrides,
  };
}

/** The value of a single ICS property, e.g. line("DTEND", ics). */
function line(name: string, ics: string): string | undefined {
  return ics
    .split("\r\n")
    .find((l) => l.startsWith(`${name}:`))
    ?.slice(name.length + 1);
}

describe("buildICS", () => {
  it("wraps one VEVENT in a VCALENDAR", () => {
    const ics = buildICS(event(), DTSTAMP);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n")).toBe(true);
  });

  it("uses CRLF line endings throughout", () => {
    const ics = buildICS(event({ description: "Line one\nLine two" }), DTSTAMP);
    // Every LF must be preceded by a CR — including none smuggled in by the
    // description, which is escaped to a literal \n rather than a real newline.
    expect(ics.match(/(?<!\r)\n/)).toBeNull();
  });

  it("carries the identifying fields", () => {
    const ics = buildICS(event(), DTSTAMP);
    expect(line("UID", ics)).toBe("11111111-2222-3333-4444-555555555555@scc-portal");
    expect(line("DTSTAMP", ics)).toBe(DTSTAMP);
    expect(line("SUMMARY", ics)).toBe("Member-Guest Tournament");
  });

  it("emits floating wall-clock stamps — no Z, no TZID", () => {
    const ics = buildICS(event({ end_time: "21:00:00" }), DTSTAMP);
    expect(line("DTSTART", ics)).toBe("20260607T183000");
    expect(line("DTEND", ics)).toBe("20260607T210000");
  });

  it("omits optional properties that aren't set", () => {
    const ics = buildICS(event(), DTSTAMP);
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });

  it("includes optional properties that are", () => {
    const ics = buildICS(
      event({ description: "Shotgun start", location: "Main Clubhouse" }),
      DTSTAMP,
    );
    expect(line("DESCRIPTION", ics)).toBe("Shotgun start");
    expect(line("LOCATION", ics)).toBe("Main Clubhouse");
  });

  it("escapes the RFC 5545 special characters", () => {
    const ics = buildICS(
      event({
        title: "Wine, Cheese; and a\\slash",
        description: "First line\nSecond line",
      }),
      DTSTAMP,
    );
    expect(line("SUMMARY", ics)).toBe("Wine\\, Cheese\\; and a\\\\slash");
    expect(line("DESCRIPTION", ics)).toBe("First line\\nSecond line");
  });

  it("escapes a CRLF newline as a single \\n", () => {
    const ics = buildICS(event({ description: "First\r\nSecond" }), DTSTAMP);
    expect(line("DESCRIPTION", ics)).toBe("First\\nSecond");
  });

  describe("DTEND", () => {
    it("defaults a missing end to one hour later", () => {
      const ics = buildICS(event({ start_time: "18:30:00" }), DTSTAMP);
      expect(line("DTEND", ics)).toBe("20260607T193000");
    });

    it("rolls a defaulted end past midnight into the next day", () => {
      const ics = buildICS(event({ start_time: "23:30:00" }), DTSTAMP);
      expect(line("DTEND", ics)).toBe("20260608T003000");
    });

    it("rolls a defaulted end across a month boundary", () => {
      const ics = buildICS(
        event({ event_date: "2026-06-30", start_time: "23:15:00" }),
        DTSTAMP,
      );
      expect(line("DTEND", ics)).toBe("20260701T001500");
    });

    // The event form now refuses these, but rows saved before that guard exist,
    // and a DTEND before its DTSTART is a broken .ics in every calendar app.
    it("ignores an end that precedes the start", () => {
      const ics = buildICS(
        event({ start_time: "18:30:00", end_time: "09:00:00" }),
        DTSTAMP,
      );
      expect(line("DTEND", ics)).toBe("20260607T193000");
    });

    it("ignores an end equal to the start", () => {
      const ics = buildICS(
        event({ start_time: "18:30:00", end_time: "18:30:00" }),
        DTSTAMP,
      );
      expect(line("DTEND", ics)).toBe("20260607T193000");
    });

    it("never emits a DTEND at or before its DTSTART", () => {
      for (const end of [null, "09:00:00", "18:30:00", "21:00:00"]) {
        const ics = buildICS(event({ end_time: end }), DTSTAMP);
        expect(line("DTEND", ics)!.localeCompare(line("DTSTART", ics)!)).toBe(1);
      }
    });
  });
});

describe("googleCalendarUrl", () => {
  it("pins the club timezone and passes a start/end pair", () => {
    const url = new URL(googleCalendarUrl(event({ end_time: "21:00:00" })));
    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render",
    );
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("ctz")).toBe("America/Chicago");
    expect(url.searchParams.get("dates")).toBe("20260607T183000/20260607T210000");
    expect(url.searchParams.get("text")).toBe("Member-Guest Tournament");
  });

  it("shares the DTEND fallback", () => {
    const url = new URL(googleCalendarUrl(event({ end_time: "09:00:00" })));
    expect(url.searchParams.get("dates")).toBe("20260607T183000/20260607T193000");
  });

  it("omits details and location when unset", () => {
    const url = new URL(googleCalendarUrl(event()));
    expect(url.searchParams.has("details")).toBe(false);
    expect(url.searchParams.has("location")).toBe(false);
  });
});

describe("eventSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(eventSlug("Member-Guest Tournament")).toBe("member-guest-tournament");
  });

  it("collapses runs of punctuation and trims the edges", () => {
    expect(eventSlug("  Wine & Cheese!! ")).toBe("wine-cheese");
  });

  it("caps the length at 60 characters", () => {
    expect(eventSlug("a".repeat(100))).toHaveLength(60);
  });

  it("falls back when nothing survives", () => {
    expect(eventSlug("!!!")).toBe("event");
    expect(eventSlug("")).toBe("event");
  });
});

describe("icsStamp", () => {
  it("formats a UTC instant with no separators", () => {
    expect(icsStamp(new Date("2026-06-07T12:00:00.000Z"))).toBe("20260607T120000Z");
  });
});

describe("buildReservationICS", () => {
  function reservation(overrides: Partial<Reservation> = {}): Reservation {
    return {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      member_id: "99999999-8888-7777-6666-555555555555",
      reservation_date: "2026-06-07",
      reservation_time: "18:30:00",
      party_size: 4,
      special_requests: null,
      status: "confirmed",
      table_id: null,
      staff_note: null,
      proposed_date: null,
      proposed_time: null,
      reminded_at: null,
      created_at: "2026-06-01T12:00:00Z",
      ...overrides,
    };
  }

  it("runs 90 minutes, carrying the hour", () => {
    const ics = buildReservationICS(reservation(), DTSTAMP);
    expect(line("DTSTART", ics)).toBe("20260607T183000");
    expect(line("DTEND", ics)).toBe("20260607T200000");
  });

  it("describes the party and appends any request", () => {
    expect(line("DESCRIPTION", buildReservationICS(reservation(), DTSTAMP))).toBe(
      "Party of 4.",
    );
    expect(
      line(
        "DESCRIPTION",
        buildReservationICS(reservation({ special_requests: "Window, please" }), DTSTAMP),
      ),
    ).toBe("Party of 4. Window\\, please");
  });

  it("namespaces its UID away from event UIDs", () => {
    const ics = buildReservationICS(reservation(), DTSTAMP);
    expect(line("UID", ics)).toBe(
      "reservation-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee@scc-portal",
    );
  });
});
