"use client";

import { useRef, useState } from "react";
import {
  createReservation,
  type ReservationState,
} from "@/app/(app)/reservations/actions";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/cn";
import type { DayOption, SlotOption } from "@/lib/reservations";

const INITIAL: ReservationState = {};

/**
 * Member booking form, concierge-chips style: horizontal day pills, a grid of
 * seating chips, and a party stepper. The selections are mirrored into hidden
 * inputs with the exact field names `createReservation` reads
 * (reservation_date / reservation_time / party_size), so the Server Action is
 * unchanged. Slots are all selectable — per-slot capacity is enforced at INSERT
 * by the DB trigger, not exposed here.
 */
export function NewReservationForm({
  slots,
  days,
  windowNote,
}: {
  slots: SlotOption[];
  days: DayOption[];
  windowNote?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ReservationState>(INITIAL);

  const [date, setDate] = useState(days[0]?.iso ?? "");
  const [time, setTime] = useState("");
  const [party, setParty] = useState(2);

  // Submit via a plain form action so a confirmed request can reset the
  // controlled chip selections in the same step (resetting controlled state in
  // an effect trips react-hooks/set-state-in-effect and wouldn't re-fire on a
  // second success). The textarea is uncontrolled, so form.reset() clears it.
  async function submit(formData: FormData) {
    const res = await createReservation(INITIAL, formData);
    setResult(res);
    if (res.success) {
      setDate(days[0]?.iso ?? "");
      setTime("");
      setParty(2);
      formRef.current?.reset();
    }
  }

  const ready = Boolean(date && time);
  const slotLabel = slots.find((s) => s.value === time)?.label;
  const dayLabel = days.find((d) => d.iso === date)?.label;
  const submitLabel = ready
    ? `Request — ${dayLabel} · ${slotLabel} · Party of ${party}`
    : "Choose a day and time";

  return (
    <form ref={formRef} action={submit} className="card p-6">
      <h2 className="text-h2 text-foreground">Request a reservation</h2>
      <p className="mt-1 text-sm text-muted">
        Staff will confirm your reservation shortly.
      </p>

      {/* Mirror the chip selections into the field names the action reads. */}
      <input type="hidden" name="reservation_date" value={date} />
      <input type="hidden" name="reservation_time" value={time} />
      <input type="hidden" name="party_size" value={party} />

      <fieldset className="mt-5">
        <legend className="label">Day</legend>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d) => {
            const active = d.iso === date;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => setDate(d.iso)}
                aria-pressed={active}
                className={cn(
                  "flex w-14 shrink-0 flex-col items-center rounded-lg border px-2 py-2 transition-colors",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-foreground hover:border-primary",
                )}
              >
                <span
                  className={cn(
                    "text-2xs font-medium uppercase tracking-wide",
                    active ? "text-white/80" : "text-muted",
                  )}
                >
                  {d.weekday}
                </span>
                <span className="text-lg font-semibold leading-tight">
                  {d.day}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">Seating</legend>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((s) => {
            const active = s.value === time;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setTime(s.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-foreground hover:border-primary",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {windowNote && <p className="field-hint">{windowNote}</p>}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">Party size</legend>
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => setParty((n) => Math.max(1, n - 1))}
            disabled={party <= 1}
            aria-label="Fewer guests"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-xl leading-none text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="w-10 text-center text-lg font-semibold tabular-nums"
          >
            {party}
          </span>
          <button
            type="button"
            onClick={() => setParty((n) => Math.min(50, n + 1))}
            disabled={party >= 50}
            aria-label="More guests"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-xl leading-none text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            +
          </button>
          <span className="text-sm text-muted">
            {party === 1 ? "guest" : "guests"}
          </span>
        </div>
      </fieldset>

      <div className="mt-5">
        <label className="label" htmlFor="special_requests">
          Special requests <span className="text-muted">(optional)</span>
        </label>
        <textarea
          id="special_requests"
          name="special_requests"
          className="textarea"
          maxLength={500}
          placeholder="Window table, high chair, dietary needs…"
        />
      </div>

      <div className="mt-6">
        <SubmitButton
          className="w-full"
          pendingText="Submitting…"
          disabled={!ready}
        >
          {submitLabel}
        </SubmitButton>
        <div className="mt-2 min-h-5 text-sm">
          {result.success && (
            <span className="text-success">Reservation requested.</span>
          )}
          {result.error && <span className="text-danger">{result.error}</span>}
        </div>
      </div>
    </form>
  );
}
