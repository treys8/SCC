"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setReservationStatus } from "@/app/(app)/reservations/actions";
import { StatusBadge } from "@/components/badges";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import type { DayOption, SlotOption } from "@/lib/reservations";
import type { Reservation, ReservationStatus } from "@/lib/database.types";

type Row = Reservation & { memberName: string };

export function StaffReservationsTable({
  rows,
  days,
  slots,
}: {
  rows: Row[];
  days: DayOption[];
  slots: SlotOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [declining, setDeclining] = useState<Row | null>(null);
  const router = useRouter();

  function update(
    id: string,
    status: ReservationStatus,
    staffNote?: string,
    proposedDate?: string,
    proposedTime?: string,
  ) {
    startTransition(async () => {
      try {
        await setReservationStatus(id, status, staffNote, proposedDate, proposedTime);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not update reservation.");
      }
    });
  }

  // Render helper (not a component) so the buttons reconcile in place instead of
  // remounting each render.
  function actions(r: Row) {
    return (
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={() => update(r.id, "confirmed")}
          disabled={pending || r.status === "confirmed"}
          className="btn btn-ghost btn-sm text-success hover:bg-success/10"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setDeclining(r)}
          disabled={pending || r.status === "declined"}
          className="btn btn-ghost btn-sm text-danger hover:bg-danger/10"
        >
          Decline
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards (no horizontal scroll). */}
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <div
            key={r.id}
            className={cn("card p-4", pending && "opacity-60")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{r.memberName}</p>
                <p className="mt-0.5 text-sm text-foreground">
                  {formatDate(r.reservation_date)}
                  <span className="text-muted">
                    {" "}
                    · {formatTime(r.reservation_time)}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  Party of {r.party_size}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            {r.special_requests && (
              <p className="mt-2 text-sm text-muted">{r.special_requests}</p>
            )}
            {r.status === "declined" && r.proposed_date && r.proposed_time && (
              <p className="mt-2 text-sm text-accent-600">
                Offered: {formatDate(r.proposed_date)} at{" "}
                {formatTime(r.proposed_time)} — awaiting member.
              </p>
            )}
            <div className="mt-3 border-t border-border pt-2">
              {actions(r)}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: full table. */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-caption uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Requests</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className={pending ? "opacity-60" : undefined}>
                <td className="px-4 py-3 font-medium text-foreground">
                  {r.memberName}
                </td>
                <td className="px-4 py-3 text-foreground">
                  {formatDate(r.reservation_date)}
                  <span className="block text-caption text-muted">
                    {formatTime(r.reservation_time)}
                  </span>
                  {r.status === "declined" &&
                    r.proposed_date &&
                    r.proposed_time && (
                      <span className="mt-0.5 block text-caption text-accent-600">
                        Offered {formatDate(r.proposed_date)} at{" "}
                        {formatTime(r.proposed_time)}
                      </span>
                    )}
                </td>
                <td className="px-4 py-3 text-muted">{r.party_size}</td>
                <td className="px-4 py-3 text-muted">
                  {r.special_requests ? (
                    <span className="line-clamp-2 max-w-48">
                      {r.special_requests}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {actions(r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {declining && (
        <DeclineDialog
          row={declining}
          days={days}
          slots={slots}
          pending={pending}
          onClose={() => setDeclining(null)}
          onSubmit={(reason, offerDate, offerTime) => {
            update(declining.id, "declined", reason, offerDate, offerTime);
            setDeclining(null);
          }}
        />
      )}
    </>
  );
}

/**
 * Decline dialog: a member-visible reason plus an optional counter-offer. When
 * "Offer a different time" is on and a time is picked, the member gets a one-tap
 * accept; otherwise it's a plain decline.
 */
function DeclineDialog({
  row,
  days,
  slots,
  pending,
  onClose,
  onSubmit,
}: {
  row: Row;
  days: DayOption[];
  slots: SlotOption[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (reason: string, offerDate?: string, offerTime?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [offering, setOffering] = useState(false);
  // Default the offer to the request's own date when it's still in range.
  const defaultDate =
    days.find((d) => d.iso === row.reservation_date)?.iso ?? days[0]?.iso ?? "";
  const [offerDate, setOfferDate] = useState(defaultDate);
  const [offerTime, setOfferTime] = useState("");

  function submit() {
    if (offering && offerDate && offerTime) {
      onSubmit(reason, offerDate, offerTime);
    } else {
      onSubmit(reason);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Decline reservation"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md space-y-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-h2 text-foreground">Decline request</h2>
          <p className="mt-0.5 text-sm text-muted">
            {row.memberName} · {formatDate(row.reservation_date)} at{" "}
            {formatTime(row.reservation_time)} · party of {row.party_size}
          </p>
        </div>

        <div>
          <label htmlFor="decline-reason" className="label">
            Reason <span className="font-normal text-muted">(optional, the member sees this)</span>
          </label>
          <textarea
            id="decline-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Fully booked at that time."
            className="textarea"
            rows={2}
          />
        </div>

        <div className="rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={offering}
              onChange={(e) => setOffering(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Offer a different time
          </label>
          {offering && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                value={offerDate}
                onChange={(e) => setOfferDate(e.target.value)}
                aria-label="Offer date"
                className="select"
              >
                {days.map((d) => (
                  <option key={d.iso} value={d.iso}>
                    {d.label}
                  </option>
                ))}
              </select>
              <select
                value={offerTime}
                onChange={(e) => setOfferTime(e.target.value)}
                aria-label="Offer time"
                className="select"
              >
                <option value="">Choose a time…</option>
                {slots.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {offering && !offerTime && (
            <p className="field-hint">
              Pick a time, or it&apos;ll be a plain decline.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="btn btn-danger btn-sm"
          >
            {offering && offerDate && offerTime ? "Decline & offer time" : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}
