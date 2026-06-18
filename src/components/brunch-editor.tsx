"use client";

import { useState, useTransition } from "react";
import { setBrunch } from "@/app/(app)/facility/actions";
import { cn } from "@/lib/cn";
import type { DiningBrunch } from "@/lib/database.types";

/**
 * Staff editor for the single Sunday-brunch row behind the Today page's brunch
 * card (shown only on Sundays). Mirrors the lunch BuffetEditor. `active` hides
 * the card; turn off the walk-in note for a Sunday that needs reservations.
 * Owns its draft until saved; not realtime (Today reflects it on next load).
 */
export function BrunchEditor({ initial }: { initial: DiningBrunch }) {
  const [form, setForm] = useState({
    title: initial.title,
    start_time: (initial.start_time ?? "").slice(0, 5),
    end_time: (initial.end_time ?? "").slice(0, 5),
    location: initial.location ?? "",
    price: initial.price ?? "",
    description: initial.description ?? "",
    walk_in: initial.walk_in,
    active: initial.active,
  });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  };

  const save = () => {
    startTransition(async () => {
      try {
        await setBrunch({
          title: form.title,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          location: form.location || null,
          price: form.price || null,
          description: form.description || null,
          walk_in: form.walk_in,
          active: form.active,
        });
        setSaved(true);
      } catch (e) {
        console.error("brunch update failed:", e);
      }
    });
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h2 text-foreground">Sunday brunch</h2>
        <p className="mt-1 text-sm text-muted">
          The dining card members see on Sundays. Turn off the walk-in note for a
          brunch that needs reservations.
        </p>
      </div>

      <div
        className={cn("card space-y-4 p-5 sm:p-6", isPending && "opacity-70")}
      >
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set({ active: e.target.checked })}
          />
          Show the brunch card on Sundays
        </label>

        <div>
          <label className="label" htmlFor="brunch-title">
            Title
          </label>
          <input
            id="brunch-title"
            className="input"
            value={form.title}
            maxLength={80}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="brunch-start">
              Start
            </label>
            <input
              id="brunch-start"
              type="time"
              className="input"
              value={form.start_time}
              onChange={(e) => set({ start_time: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="brunch-end">
              End
            </label>
            <input
              id="brunch-end"
              type="time"
              className="input"
              value={form.end_time}
              onChange={(e) => set({ end_time: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="brunch-location">
              Location
            </label>
            <input
              id="brunch-location"
              className="input"
              value={form.location}
              maxLength={80}
              onChange={(e) => set({ location: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="brunch-price">
              Price
            </label>
            <input
              id="brunch-price"
              className="input"
              value={form.price}
              maxLength={40}
              placeholder="$24 per person"
              onChange={(e) => set({ price: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="brunch-desc">
            Menu
          </label>
          <textarea
            id="brunch-desc"
            className="textarea"
            value={form.description}
            maxLength={200}
            placeholder="Omelet station, carving board, pastries…"
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.walk_in}
            onChange={(e) => set({ walk_in: e.target.checked })}
          />
          Show the walk-in note
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="btn btn-primary btn-sm"
          >
            Save
          </button>
          {saved && !isPending && (
            <span className="text-caption text-success">Saved</span>
          )}
        </div>
      </div>
    </section>
  );
}
