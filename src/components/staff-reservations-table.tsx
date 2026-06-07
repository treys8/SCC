"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setReservationStatus } from "@/app/(app)/reservations/actions";
import { StatusBadge } from "@/components/badges";
import { formatDate, formatTime } from "@/lib/format";
import type { Reservation, ReservationStatus } from "@/lib/database.types";

type Row = Reservation & { memberName: string };

export function StaffReservationsTable({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update(id: string, status: ReservationStatus) {
    startTransition(async () => {
      try {
        await setReservationStatus(id, status);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not update reservation.");
      }
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
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
                  <span className="block text-xs text-muted">
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
                      onClick={() => update(r.id, "cancelled")}
                      disabled={pending || r.status === "cancelled"}
                      className="btn btn-ghost btn-sm text-danger hover:bg-danger/10"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
