import Link from "next/link";
import { StatusBadge } from "@/components/badges";
import type { Reservation } from "@/lib/database.types";
import { formatDate, formatTime, todayISO } from "@/lib/format";

/**
 * The member's soonest confirmed reservation, as a tap-through card on the Today
 * page. "Tonight" stands in for today (dining seatings are all evening); future
 * dates show the full date. Renders nothing when there's no upcoming reservation.
 */
export function NextReservationCard({
  reservation,
}: {
  reservation: Reservation | null;
}) {
  if (!reservation) return null;

  const isToday = reservation.reservation_date === todayISO();
  const when = isToday ? "Tonight" : formatDate(reservation.reservation_date);

  return (
    <Link
      href="/reservations"
      className="card flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-2 sm:p-5"
    >
      <div className="min-w-0">
        <p className="font-serif text-lg font-semibold text-foreground">
          {when} · {formatTime(reservation.reservation_time)}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          Party of {reservation.party_size}
        </p>
      </div>
      <StatusBadge status={reservation.status} />
    </Link>
  );
}
