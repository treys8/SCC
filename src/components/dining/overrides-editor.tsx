"use client";

import { useState, useTransition } from "react";
import {
  countActiveReservationsOn,
  deleteServiceOverride,
  setWeeklyClosedWeekdays,
  upsertServiceOverride,
} from "@/app/(app)/facility/actions";
import { cn } from "@/lib/cn";
import { clubTodayISO, formatLongDate, formatTimeRange } from "@/lib/format";
import type {
  DiningOverrideKind,
  DiningServiceOverride,
} from "@/lib/database.types";

/** ISO weekday order (1=Mon … 7=Sun), matching the stored array. */
const WEEKDAYS = [
  { iso: 1, label: "Mon" },
  { iso: 2, label: "Tue" },
  { iso: 3, label: "Wed" },
  { iso: 4, label: "Thu" },
  { iso: 5, label: "Fri" },
  { iso: 6, label: "Sat" },
  { iso: 7, label: "Sun" },
];

const BLANK = {
  date: "",
  kind: "closed" as DiningOverrideKind,
  name: "",
  description: "",
  serviceStart: "",
  serviceEnd: "",
  maxReservationsPerSlot: "",
  maxCoversPerSlot: "",
  reservationsRequired: true,
};

/**
 * Staff editor for the two layers that override the derived dining schedule: the
 * standing weekly closure (the club is shut Mondays) and the date-keyed
 * exceptions to it — a one-off closure, or a special service that takes over the
 * day with its own name, menu, hours, and caps.
 *
 * Closing a date doesn't touch reservations already on it (the DB trigger only
 * guards new and changed rows), so saving warns when a date has active bookings
 * — staff resolve those by declining them.
 */
export function OverridesEditor({
  initialOverrides,
  initialWeeklyClosed,
}: {
  initialOverrides: DiningServiceOverride[];
  initialWeeklyClosed: number[];
}) {
  const [weeklyClosed, setWeekly] = useState<number[]>(initialWeeklyClosed);
  const [form, setForm] = useState({ ...BLANK });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
  };

  function edit(o: DiningServiceOverride) {
    setEditing(o.date);
    setWarning(null);
    setError(null);
    setForm({
      date: o.date,
      kind: o.kind,
      name: o.name ?? "",
      description: o.description ?? "",
      serviceStart: (o.service_start ?? "").slice(0, 5),
      serviceEnd: (o.service_end ?? "").slice(0, 5),
      maxReservationsPerSlot: o.max_reservations_per_slot?.toString() ?? "",
      maxCoversPerSlot: o.max_covers_per_slot?.toString() ?? "",
      reservationsRequired: o.reservations_required,
    });
  }

  function reset() {
    setEditing(null);
    setForm({ ...BLANK });
    setError(null);
    setWarning(null);
  }

  const toNumOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

  function save() {
    if (!form.date) {
      setError("Choose a date.");
      return;
    }
    startTransition(async () => {
      try {
        // Existing bookings survive a closure — say so rather than silently
        // leaving members holding a table that no longer exists.
        const active = await countActiveReservationsOn(form.date);
        await upsertServiceOverride({
          date: form.date,
          kind: form.kind,
          name: form.name || null,
          description: form.description || null,
          serviceStart: form.serviceStart || null,
          serviceEnd: form.serviceEnd || null,
          maxReservationsPerSlot: toNumOrNull(form.maxReservationsPerSlot),
          maxCoversPerSlot: toNumOrNull(form.maxCoversPerSlot),
          reservationsRequired: form.reservationsRequired,
        });
        setWarning(
          active > 0
            ? `Saved. Heads up: ${active} reservation${
                active === 1 ? "" : "s"
              } already booked that day still stand — decline them if they can't be honoured.`
            : null,
        );
        setEditing(null);
        setForm({ ...BLANK });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that day.");
      }
    });
  }

  function remove(date: string) {
    startTransition(async () => {
      try {
        await deleteServiceOverride(date);
        if (editing === date) reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove that day.");
      }
    });
  }

  function toggleWeekday(iso: number) {
    const next = weeklyClosed.includes(iso)
      ? weeklyClosed.filter((d) => d !== iso)
      : [...weeklyClosed, iso].sort((a, b) => a - b);
    setWeekly(next);
    startTransition(async () => {
      try {
        await setWeeklyClosedWeekdays(next);
      } catch (e) {
        setWeekly(weeklyClosed); // put the toggle back
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  const isClosedKind = form.kind === "closed";
  const upcoming = initialOverrides.filter((o) => o.date >= clubTodayISO());

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h2 text-foreground">Closures &amp; special days</h2>
        <p className="mt-1 text-sm text-muted">
          The days that break the usual pattern. A special day replaces normal
          service — its name, menu, and hours are what members see and book.
        </p>
      </div>

      <div className={cn("card space-y-5 p-5 sm:p-6", isPending && "opacity-70")}>
        <div>
          <span className="label">Closed every week on</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = weeklyClosed.includes(d.iso);
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => toggleWeekday(d.iso)}
                  aria-pressed={on}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-sm font-medium transition-colors",
                    on
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface text-muted hover:border-primary",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <p className="field-hint">
            No dining and no bookings on these days. Add a special day below to
            open one anyway — a holiday Monday, say.
          </p>
        </div>

        <hr className="border-border" />

        {/* Upcoming exceptions */}
        <div>
          <span className="label">Upcoming exceptions</span>
          {upcoming.length === 0 ? (
            <p className="mt-1 text-sm text-muted">
              Nothing scheduled — the usual pattern applies.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {upcoming.map((o) => (
                <li
                  key={o.date}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3"
                >
                  <span className="font-medium text-foreground">
                    {formatLongDate(o.date)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide",
                      o.kind === "closed"
                        ? "bg-surface-2 text-muted"
                        : "bg-accent/10 text-accent-600",
                    )}
                  >
                    {o.kind === "closed" ? "Closed" : "Special"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">
                    {o.name}
                    {o.kind === "special" && o.service_start && (
                      <> · {formatTimeRange(o.service_start, o.service_end)}</>
                    )}
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => edit(o)}
                      className="btn btn-outline btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(o.date)}
                      disabled={isPending}
                      className="btn btn-ghost btn-sm text-danger"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <hr className="border-border" />

        {/* Add / edit one date */}
        <div className="space-y-4">
          <span className="label">
            {editing ? `Edit ${formatLongDate(editing)}` : "Add a day"}
          </span>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ov-date">
                Date
              </label>
              <input
                id="ov-date"
                type="date"
                className="input"
                value={form.date}
                min={clubTodayISO()}
                disabled={!!editing}
                onChange={(e) => set({ date: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="ov-kind">
                What&rsquo;s happening
              </label>
              <select
                id="ov-kind"
                className="select"
                value={form.kind}
                onChange={(e) =>
                  set({ kind: e.target.value as DiningOverrideKind })
                }
              >
                <option value="closed">Closed — no dining</option>
                <option value="special">Special service</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="ov-name">
              Name{" "}
              <span className="font-normal text-muted">
                {isClosedKind ? "(optional)" : ""}
              </span>
            </label>
            <input
              id="ov-name"
              className="input"
              value={form.name}
              maxLength={80}
              placeholder={
                isClosedKind ? "Closed for maintenance" : "Mother's Day Brunch"
              }
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="ov-desc">
              {isClosedKind ? "Note" : "Menu / details"}{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="ov-desc"
              className="textarea"
              value={form.description}
              maxLength={300}
              placeholder={
                isClosedKind
                  ? "Back Tuesday for lunch."
                  : "Carving board, omelet station, bottomless mimosas…"
              }
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          {!isClosedKind && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="ov-start">
                    Service starts
                  </label>
                  <input
                    id="ov-start"
                    type="time"
                    className="input"
                    value={form.serviceStart}
                    onChange={(e) => set({ serviceStart: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ov-end">
                    Service ends
                  </label>
                  <input
                    id="ov-end"
                    type="time"
                    className="input"
                    value={form.serviceEnd}
                    onChange={(e) => set({ serviceEnd: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="ov-maxres">
                    Tables per seating
                  </label>
                  <input
                    id="ov-maxres"
                    type="number"
                    min={0}
                    className="input"
                    value={form.maxReservationsPerSlot}
                    onChange={(e) =>
                      set({ maxReservationsPerSlot: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ov-maxcov">
                    Covers per seating
                  </label>
                  <input
                    id="ov-maxcov"
                    type="number"
                    min={0}
                    className="input"
                    value={form.maxCoversPerSlot}
                    onChange={(e) => set({ maxCoversPerSlot: e.target.value })}
                  />
                </div>
              </div>
              <p className="field-hint">
                Leave the hours and caps blank to use the club&rsquo;s usual ones.
              </p>

              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={form.reservationsRequired}
                  onChange={(e) =>
                    set({ reservationsRequired: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border"
                />
                Reservations required
              </label>
            </>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          {warning && <p className="text-sm text-accent-600">{warning}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="btn btn-primary btn-sm"
            >
              {editing ? "Save changes" : "Add day"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={reset}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
