import Link from "next/link";
import { StatusBadge } from "@/components/badges";
import { formatTime } from "@/lib/format";
import type { BookingSettings } from "@/lib/reservations";
import type { Reservation } from "@/lib/database.types";

/**
 * The page's hero card: the member's own dining reservation for tonight, or a
 * warm invitation when nothing's booked. Booking *times* are deliberately
 * omitted — this is a concierge glance ("you're set for this evening"), not a
 * receipt. Only this card swaps between states; the rest of the page is fixed.
 */
export function TonightCard({
  reservation,
  settings,
}: {
  reservation: Reservation | null;
  settings: BookingSettings;
}) {
  return reservation ? (
    <BookedTonight reservation={reservation} />
  ) : (
    <InvitationTonight settings={settings} />
  );
}

function BookedTonight({ reservation }: { reservation: Reservation }) {
  const pending = reservation.status === "pending";
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <Eyebrow />
        <StatusBadge status={reservation.status} />
      </div>
      <h2 className="mt-2 text-h1 leading-snug text-foreground">
        {pending
          ? "Your table request is in for this evening."
          : "Your table is set for this evening."}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Party of {reservation.party_size}
        {reservation.special_requests ? ` · ${reservation.special_requests}` : ""}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/reservations" className="btn btn-outline btn-sm">
          View reservation
        </Link>
        <a
          href={`/reservations/${reservation.id}/ics`}
          className="btn btn-outline btn-sm"
        >
          <CalendarIcon /> Add to calendar
        </a>
      </div>
    </section>
  );
}

function InvitationTonight({ settings }: { settings: BookingSettings }) {
  return (
    <section className="card flex flex-col items-center px-6 py-10 text-center sm:py-12">
      <Eyebrow />
      <span
        aria-hidden
        className="mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5"
      >
        <ForkKnifeIcon />
      </span>
      <h2 className="mt-5 text-h1 text-foreground">Nothing booked yet</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        Dinner seatings run {formatTime(settings.service_start)}–
        {formatTime(settings.service_end)}.
      </p>
      <Link href="/reservations" className="btn btn-primary mt-5">
        Reserve a table
      </Link>
    </section>
  );
}

function Eyebrow() {
  return (
    <p className="text-caption font-medium uppercase tracking-widest text-accent-600">
      Tonight
    </p>
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

function ForkKnifeIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3v7a2 2 0 0 0 4 0V3" />
      <path d="M8 3v18" />
      <path d="M17 3c-1.4 1-2 3-2 5s.6 3 2 3v10" />
    </svg>
  );
}
