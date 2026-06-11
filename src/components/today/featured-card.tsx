import Link from "next/link";
import { formatTime } from "@/lib/format";
import type { CalendarEvent } from "@/lib/database.types";

/**
 * The Today page's featured event — a full-bleed cover card for the event staff
 * have flagged as today's highlight (calendar_events.is_highlight). The cover
 * image (or a green gradient fallback) sits under a scrim, with a time-aware
 * eyebrow, the serif title, and a CTA into the event. The page renders this only
 * when a highlighted event exists today, so it can assume `event` is present.
 */
export function FeaturedCard({ event }: { event: CalendarEvent }) {
  const reserve = Boolean(event.registration_url);
  return (
    <Link
      href={`/calendar/${event.id}`}
      className="group relative block aspect-[16/9] overflow-hidden rounded-xl border border-border shadow-sm sm:aspect-[21/9]"
    >
      {event.cover_image_url ? (
        // Event covers aren't in next/image's allowlist — plain img (cf. event-form).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.cover_image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-700" />
      )}
      {/* Scrim so the text stays legible over any cover image. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
        <p className="text-caption font-medium uppercase tracking-widest text-white/80">
          {featuredEyebrow(event.start_time)}
        </p>
        <h2 className="mt-1.5 font-serif text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {event.title}
        </h2>
        {event.location && (
          <p className="mt-1 text-sm text-white/85">{event.location}</p>
        )}
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
          {reserve ? "Reserve" : "View details"}
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

/** A time-of-day eyebrow + start time, e.g. "TONIGHT · 6:30 PM". */
function featuredEyebrow(startTime: string): string {
  const hour = Number(startTime.split(":")[0]);
  const part =
    hour >= 17 ? "Tonight" : hour >= 12 ? "This afternoon" : "This morning";
  return `${part} · ${formatTime(startTime)}`;
}
