"use client";

import { useState, useTransition } from "react";
import { setBuffetDay } from "@/app/(app)/facility/actions";
import type { Dish } from "@/lib/database.types";

export type WeekDay = {
  weekday: number;
  is_closed: boolean;
  note: string | null;
  main_dish_id: string | null;
  side_ids: string[];
};

// ISO weekday (1=Mon … 7=Sun) → label.
const DAY_LABEL: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/**
 * The recurring weekly buffet plan: one row per weekday, each opened in a
 * pop-out to set the day's main dish, sides, a note, or mark it closed. Picks
 * come from the dish catalog. The plan repeats every week until changed; the
 * Today card reads whichever day it currently is.
 */
export function WeekEditor({
  week,
  dishes,
}: {
  week: WeekDay[];
  dishes: Dish[];
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const nameById = new Map(dishes.map((d) => [d.id, d.name]));
  const days = week.slice().sort((a, b) => a.weekday - b.weekday);
  const active = days.find((d) => d.weekday === editing);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h2 text-foreground">This week&apos;s buffet</h2>
        <p className="mt-0.5 text-sm text-muted">
          Set each day&apos;s main and sides. It repeats every week until you
          change it — today&apos;s plan shows on the member home page.
        </p>
      </div>

      <ul className="card divide-y divide-border overflow-hidden">
        {days.map((day) => {
          const main = day.main_dish_id ? nameById.get(day.main_dish_id) : null;
          const sides = day.side_ids
            .map((id) => nameById.get(id))
            .filter(Boolean) as string[];
          return (
            <li
              key={day.weekday}
              className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {DAY_LABEL[day.weekday]}
                </p>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {day.is_closed
                    ? "Closed"
                    : main
                      ? sides.length > 0
                        ? `${main} · ${sides.join(", ")}`
                        : main
                      : "Not set"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(day.weekday)}
                className="btn btn-outline btn-sm shrink-0"
              >
                Edit
              </button>
            </li>
          );
        })}
      </ul>

      {active && (
        <DayDialog
          day={active}
          dishes={dishes}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function DayDialog({
  day,
  dishes,
  onClose,
}: {
  day: WeekDay;
  dishes: Dish[];
  onClose: () => void;
}) {
  const [mainId, setMainId] = useState(day.main_dish_id ?? "");
  const [sideIds, setSideIds] = useState<Set<string>>(
    () => new Set(day.side_ids),
  );
  const [note, setNote] = useState(day.note ?? "");
  const [closed, setClosed] = useState(day.is_closed);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Offer active dishes, plus any already chosen for this day even if since
  // deactivated, so editing a day never silently drops a current pick.
  const mains = dishes.filter(
    (d) => d.kind === "main" && (d.active || d.id === day.main_dish_id),
  );
  const sides = dishes.filter(
    (d) => d.kind === "side" && (d.active || day.side_ids.includes(d.id)),
  );

  const toggleSide = (id: string, on: boolean) =>
    setSideIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await setBuffetDay(day.weekday, {
          mainDishId: mainId || null,
          sideDishIds: [...sideIds],
          note: note.trim() || null,
          isClosed: closed,
        });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save that day.");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${DAY_LABEL[day.weekday]} buffet`}
      onClick={onClose}
    >
      <div
        className="card max-h-[85vh] w-full max-w-md space-y-4 overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-h2 text-foreground">{DAY_LABEL[day.weekday]}</h2>

        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={closed}
            onChange={(e) => setClosed(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Closed this day (no buffet)
        </label>

        {!closed && (
          <>
            <div>
              <label htmlFor="day-main" className="label">
                Main dish
              </label>
              <select
                id="day-main"
                value={mainId}
                onChange={(e) => setMainId(e.target.value)}
                className="select"
              >
                <option value="">No main</option>
                {mains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {mains.length === 0 && (
                <p className="field-hint">
                  Add mains in the dish catalog below to pick one here.
                </p>
              )}
            </div>

            <div>
              <span className="label">Sides</span>
              {sides.length > 0 ? (
                <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {sides.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={sideIds.has(d.id)}
                        onChange={(e) => toggleSide(d.id, e.target.checked)}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                      <span className="min-w-0 truncate">{d.name}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <p className="field-hint">
                  Add sides in the dish catalog below to pick them here.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="day-note" className="label">
                Note{" "}
                <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="day-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={120}
                placeholder="e.g. Carving station tonight"
                className="input"
              />
            </div>
          </>
        )}

        {error && <p className="text-caption text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="btn btn-primary btn-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
