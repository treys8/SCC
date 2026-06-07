import { googleCalendarUrl } from "@/lib/ics";
import type { CalendarEvent } from "@/lib/database.types";

/** Two links to drop an event into the member's own calendar. */
export function AddToCalendar({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline btn-sm"
      >
        <CalendarIcon /> Google Calendar
      </a>
      <a href={`/calendar/${event.id}/ics`} className="btn btn-outline btn-sm">
        <DownloadIcon /> Apple / Outlook
      </a>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
    </svg>
  );
}
