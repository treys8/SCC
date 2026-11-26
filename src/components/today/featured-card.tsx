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
      className={
        // Without a cover photo there's nothing to look at, so the plain green
        // panel is kept short rather than a big empty frame.
        event.cover_image_url
          ? "group relative block aspect-[4/3] overflow-hidden rounded-lg sm:aspect-[21/9]"
          : "group relative block aspect-[16/10] overflow-hidden rounded-lg sm:aspect-[7/2]"
      }
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
        <div className="absolute inset-0 bg-green-deep bg-[radial-gradient(ellipse_at_top_right,rgba(217,194,154,0.18),transparent_60%)]" />
      )}
      {/* Scrim so the text stays legible over any cover image. */}
      <div className="absolute inset-0 bg-gradient-to-t from-green-darker/90 via-green-darker/35 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-6 text-cream sm:p-10">
        <p className="eyebrow text-gold-soft">
          {featuredEyebrow(event.start_time)}
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-[1.05] font-normal tracking-[-0.01em] sm:text-5xl">
          {event.title}
        </h2>
        {event.location && (
          <p className="mt-2 text-sm text-cream/80">{event.location}</p>
        )}
        <span className="mt-5 inline-flex items-center gap-1.5 border-b border-gold-soft/60 pb-0.5 text-sm tracking-[0.03em] text-gold-soft">
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
