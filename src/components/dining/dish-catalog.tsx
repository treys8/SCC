"use client";

import { useState, useTransition } from "react";
import {
  bulkAddDishes,
  createDish,
  setDishActive,
} from "@/app/(app)/facility/actions";
import { cn } from "@/lib/cn";
import type { Dish, DishKind } from "@/lib/database.types";

const KIND_LABEL: Record<DishKind, { title: string; one: string }> = {
  main: { title: "Mains", one: "main dish" },
  side: { title: "Sides", one: "side" },
};

/**
 * The dish catalog the week editor's pop-out picks from. Two columns (Mains /
 * Sides); each lets staff add a single dish, paste a whole list at once, and
 * deactivate dishes they no longer serve (kept in the DB so past schedules
 * survive, just hidden from the picker). Every write re-pulls the server data
 * so a new dish shows up in the picker immediately.
 */
export function DishCatalog({ dishes }: { dishes: Dish[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h2 text-foreground">Dish catalog</h2>
        <p className="mt-0.5 text-sm text-muted">
          The mains and sides the weekly menu picks from. Add them once and reuse
          all season.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <DishColumn kind="main" dishes={dishes.filter((d) => d.kind === "main")} />
        <DishColumn kind="side" dishes={dishes.filter((d) => d.kind === "side")} />
      </div>
    </section>
  );
}

function DishColumn({ kind, dishes }: { kind: DishKind; dishes: Dish[] }) {
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const label = KIND_LABEL[kind];

  const add = () => {
    const clean = name.trim();
    if (!clean) return;
    setNote(null);
    startTransition(async () => {
      try {
        await createDish(clean, kind);
        setName("");
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not add that dish.");
      }
    });
  };

  const addList = () => {
    if (!bulk.trim()) return;
    setNote(null);
    startTransition(async () => {
      try {
        const added = await bulkAddDishes(bulk, kind);
        setBulk("");
        setShowBulk(false);
        setNote(
          added === 0
            ? "Nothing new to add — those are already on the list."
            : `Added ${added} ${added === 1 ? label.one : `${label.title.toLowerCase()}`}.`,
        );
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not add that list.");
      }
    });
  };

  const toggle = (dish: Dish) => {
    startTransition(async () => {
      try {
        await setDishActive(dish.id, !dish.active);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not update that dish.");
      }
    });
  };

  return (
    <div className={cn("card space-y-3 p-4 sm:p-5", isPending && "opacity-70")}>
      <h3 className="font-medium text-foreground">{label.title}</h3>

      {dishes.length > 0 ? (
        <ul className="space-y-1">
          {dishes.map((dish) => (
            <li
              key={dish.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span
                className={cn(
                  "min-w-0 truncate",
                  dish.active ? "text-foreground" : "text-muted line-through",
                )}
              >
                {dish.name}
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => toggle(dish)}
                className="shrink-0 text-xs font-medium text-accent-600"
              >
                {dish.active ? "Remove" : "Restore"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No {label.title.toLowerCase()} yet.</p>
      )}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          maxLength={80}
          placeholder={`Add a ${label.one}`}
          aria-label={`Add a ${label.one}`}
          className="input"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={add}
          className="btn btn-outline btn-sm shrink-0"
        >
          Add
        </button>
      </div>

      {showBulk ? (
        <div className="space-y-2">
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={`One ${label.one} per line`}
            aria-label={`Paste a list of ${label.title.toLowerCase()}`}
            className="textarea"
            rows={4}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={addList}
              className="btn btn-primary btn-sm"
            >
              Add list
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setShowBulk(false);
                setBulk("");
              }}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowBulk(true)}
          className="text-sm font-medium text-accent-600"
        >
          Paste a list…
        </button>
      )}

      {note && <p className="text-caption text-muted">{note}</p>}
    </div>
  );
}
