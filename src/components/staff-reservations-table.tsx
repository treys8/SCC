"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setReservationStatus } from "@/app/(app)/reservations/actions";
import { StatusBadge } from "@/components/badges";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import type { Reservation, ReservationStatus } from "@/lib/database.types";

type Row = Reservation & { memberName: string };

export function StaffReservationsTable({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update(id: string, status: ReservationStatus, staffNote?: string) {
    startTransition(async () => {
      try {
        await setReservationStatus(id, status, staffNote);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not update reservation.");
      }
    });
  }

  // Declining records a member-visible reason; an empty reason is allowed, but
  // dismissing the prompt aborts.
  function decline(id: string) {
    const reason = prompt(
      "Reason for declining (optional — the member will see this):",
    );
    if (reason === null) return;
    update(id, "declined", reason);
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
          onClick={() => decline(r.id)}
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
    </>
  );
}
