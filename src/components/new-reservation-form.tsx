"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createReservation,
  type ReservationState,
} from "@/app/(app)/reservations/actions";
import { SubmitButton } from "@/components/submit-button";
import { todayISO } from "@/lib/format";
import type { SlotOption } from "@/lib/reservations";

const INITIAL: ReservationState = {};

export function NewReservationForm({
  slots,
  windowNote,
}: {
  slots: SlotOption[];
  windowNote?: string;
}) {
  const [state, formAction] = useActionState(createReservation, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="card p-6">
      <h2 className="text-h2 text-foreground">
        Request a reservation
      </h2>
      <p className="mt-1 text-sm text-muted">
        Staff will confirm your reservation shortly.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="reservation_date">
            Date
          </label>
          <input
            id="reservation_date"
            name="reservation_date"
            type="date"
            required
            min={todayISO()}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="reservation_time">
            Time
          </label>
          <select
            id="reservation_time"
            name="reservation_time"
            required
            defaultValue=""
            className="select"
          >
            <option value="" disabled>
              Select a time
            </option>
            {slots.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {windowNote && <p className="field-hint">{windowNote}</p>}
        </div>
        <div>
          <label className="label" htmlFor="party_size">
            Party size
          </label>
          <input
            id="party_size"
            name="party_size"
            type="number"
            min={1}
            max={50}
            defaultValue={2}
            required
            className="input"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="special_requests">
          Special requests <span className="text-muted">(optional)</span>
        </label>
        <textarea
          id="special_requests"
          name="special_requests"
          className="textarea"
          placeholder="Window table, high chair, dietary needs…"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton className="w-full sm:w-auto" pendingText="Submitting…">
          Request reservation
        </SubmitButton>
        {state.success && (
          <span className="text-sm text-success">Reservation requested.</span>
        )}
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
