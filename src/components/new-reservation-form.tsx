"use client";

import { useRef, useState } from "react";
import {
  createReservation,
  joinWaitlist,
  type ReservationState,
} from "@/app/(app)/reservations/actions";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/cn";
import {
  isSlotFull,
  slotKey,
  type DayOption,
  type SlotFullness,
  type SlotOption,
} from "@/lib/reservations";

const INITIAL: ReservationState = {};

/** Per-date booking detail: a special day can run its own hours and menu. */
export type DayDetail = {
  slots: SlotOption[];
  windowNote: string | null;
  /** The special service's details, when the day has one. */
  description: string | null;
};

/**
 * Member booking form, concierge-chips style: horizontal day pills, a grid of
 * seating chips, and a party stepper. The selections are mirrored into hidden
 * inputs with the exact field names `createReservation` reads
 * (reservation_date / reservation_time / party_size), so the Server Action is
 * unchanged. Slots are all selectable — per-slot capacity is enforced at INSERT
 * by the DB trigger, not exposed here.
 *
 * Seatings come per-date rather than as one global grid: a closed day offers
 * none, and a special day runs its own hours (see lib/dining.ts).
 */
export function NewReservationForm({
  days,
  details,
  availability,
}: {
  days: DayOption[];
  details: Record<string, DayDetail>;
  /** How full each seating is, keyed by `slotKey` — drives the waitlist chips. */
  availability: Record<string, SlotFullness>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ReservationState>(INITIAL);
  const [succeededAs, setSucceededAs] = useState<
    "reservation" | "waitlist" | null
  >(null);

  // Open on the first day that's actually bookable — landing on a closed
  // Monday with an empty seating grid reads as broken.
  const firstOpen = days.find((d) => !d.closed) ?? days[0];
  const [date, setDate] = useState(firstOpen?.iso ?? "");
  const [time, setTime] = useState("");
  const [party, setParty] = useState(2);

  // Submit via a plain form action so a confirmed request can reset the
  // controlled chip selections in the same step (resetting controlled state in
  // an effect trips react-hooks/set-state-in-effect and wouldn't re-fire on a
  // second success). The textarea is uncontrolled, so form.reset() clears it.
  const selectedDay = days.find((d) => d.iso === date);
  const detail = details[date];
  const slots = detail?.slots ?? [];
  const ready = Boolean(date && time);
  const slotLabel = slots.find((s) => s.value === time)?.label;
  const dayLabel = selectedDay?.label;
  const selectedRequired = selectedDay?.required ?? false;

  /** Fullness is party-relative: a slot with room for 2 is full to a party of 6. */
  const fullFor = (slotValue: string) =>
    isSlotFull(availability[slotKey(date, slotValue)], party);
  // Requesting a full seating would just bounce off the capacity trigger; offer
  // to wait instead.
  const waiting = ready && fullFor(time);

  async function submit(formData: FormData) {
    const joined = waiting;
    const res = joined
      ? await joinWaitlist(INITIAL, formData)
      : await createReservation(INITIAL, formData);
    setResult(res);
    if (res.success) {
      // Remember which it was: the reset below clears the selection `waiting`
      // is derived from, so the confirmation can't read it back.
      setSucceededAs(joined ? "waitlist" : "reservation");
      setDate(firstOpen?.iso ?? "");
      setTime("");
      setParty(2);
      formRef.current?.reset();
    }
  }

  const submitLabel = !ready
    ? "Choose a day and time"
    : waiting
      ? `Join the waitlist — ${dayLabel} · ${slotLabel} · Party of ${party}`
      : `Request — ${dayLabel} · ${slotLabel} · Party of ${party}`;

  /** Picking a different day drops a seating that may not exist on the new one. */
  function pickDate(iso: string) {
    setDate(iso);
    setTime("");
  }

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
                onClick={() => pickDate(d.iso)}
                disabled={d.closed}
                aria-pressed={active}
                title={d.closed ? "Closed for dining" : d.specialName ?? undefined}
                className={cn(
                  "flex w-14 shrink-0 flex-col items-center rounded-lg border px-2 py-2 transition-colors",
                  d.closed
                    ? "cursor-not-allowed border-border bg-surface-2 text-muted"
                    : active
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface text-foreground hover:border-primary",
                )}
              >
                <span
                  className={cn(
                    "text-2xs font-medium uppercase tracking-wide",
                    active && !d.closed ? "text-white/80" : "text-muted",
                  )}
                >
                  {d.weekday}
                </span>
                <span
                  className={cn(
                    "text-lg font-semibold leading-tight",
                    d.closed && "line-through",
                  )}
                >
                  {d.day}
                </span>
                {d.closed ? (
                  <span className="mt-0.5 text-3xs uppercase tracking-wide text-muted">
                    Closed
                  </span>
                ) : (
                  d.required && (
                    <span
                      aria-hidden
                      title="Reservations required"
                      className={cn(
                        "mt-1 h-1.5 w-1.5 rounded-full",
                        active ? "bg-white/90" : "bg-accent",
                      )}
                    />
                  )
                )}
              </button>
            );
          })}
        </div>
        {selectedDay?.specialName && (
          <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
            <p className="font-medium text-foreground">
              {selectedDay.specialName}
            </p>
            {detail?.description && (
              <p className="mt-1 text-sm text-muted">{detail.description}</p>
            )}
          </div>
        )}
        {selectedRequired && (
          <p className="mt-2 text-sm font-medium text-accent-600">
            Reservations required for {dayLabel}.
          </p>
        )}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">Seating</legend>
        {slots.length === 0 ? (
          <p className="text-sm text-muted">
            No seatings that day — the club is closed for dining.
          </p>
        ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((s) => {
            const active = s.value === time;
            const full = fullFor(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setTime(s.value)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors sm:min-h-0",
                  active
                    ? "border-primary bg-primary text-white"
                    : full
                      ? "border-accent/40 bg-accent/5 text-foreground hover:border-accent"
                      : "border-border bg-surface text-foreground hover:border-primary",
                )}
              >
                <span>{s.label}</span>
                {full && (
                  <span
                    className={cn(
                      "text-3xs font-semibold uppercase tracking-wide",
                      active ? "text-white/80" : "text-accent-600",
                    )}
                  >
                    Full · waitlist
                  </span>
                )}
              </button>
            );
          })}
        </div>
        )}
        {detail?.windowNote && <p className="field-hint">{detail.windowNote}</p>}
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
        {waiting && (
          <p className="field-hint">
            That seating is full. Join the waitlist and we&rsquo;ll let you know
            the moment a table opens up — first come, first served.
          </p>
        )}
        <div className="mt-2 min-h-5 text-sm">
          {result.success && (
            <span className="text-success">
              {succeededAs === "waitlist"
                ? "You're on the waitlist — we'll let you know."
                : "Reservation requested."}
            </span>
          )}
          {result.error && <span className="text-danger">{result.error}</span>}
        </div>
      </div>
    </form>
  );
}
