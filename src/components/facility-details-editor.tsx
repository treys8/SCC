"use client";

import { useRef, useState, useTransition } from "react";
import { setFacilityDetails } from "@/app/(app)/facility/actions";
import { cn } from "@/lib/cn";
import { FACILITY_LABEL } from "@/lib/constants";
import type {
  FacilityDetail,
  FacilityStatus,
  FacilityType,
} from "@/lib/database.types";

/**
 * Staff editor for the conditions detail rows shown under each facility's status
 * on the Today page. One card per facility; each holds a small editable list of
 * label/value rows. Saves the whole list at once via `setFacilityDetails`. These
 * rows aren't realtime, so there's no live merge here — the editor owns its
 * draft until saved.
 */
const MAX_DETAILS = 6;

export function FacilityDetailsEditor({
  facilities,
}: {
  facilities: FacilityStatus[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h2 text-foreground">Conditions detail</h2>
        <p className="mt-1 text-sm text-muted">
          The labelled rows shown under each status on the member home page.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {facilities.map((f) => (
          <DetailsCard
            key={f.facility}
            facility={f.facility}
            initial={f.details}
          />
        ))}
      </div>
    </section>
  );
}

/** A row carries a stable client id so editing a label doesn't remount inputs. */
type DraftRow = FacilityDetail & { id: number };

function DetailsCard({
  facility,
  initial,
}: {
  facility: FacilityType;
  initial: FacilityDetail[];
}) {
  const nextId = useRef(initial.length);
  const [rows, setRows] = useState<DraftRow[]>(
    initial.map((d, i) => ({ ...d, id: i })),
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const update = (id: number, patch: Partial<FacilityDetail>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaved(false);
  };
  const remove = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSaved(false);
  };
  const add = () => {
    setRows((prev) => [...prev, { id: nextId.current++, label: "", value: "" }]);
    setSaved(false);
  };

  const save = () => {
    const clean = rows
      .map((r) => ({ label: r.label.trim(), value: r.value.trim() }))
      .filter((r) => r.label && r.value);
    startTransition(async () => {
      try {
        await setFacilityDetails(facility, clean);
        setSaved(true);
      } catch (e) {
        console.error("facility details update failed:", e);
      }
    });
  };

  return (
    <div className={cn("card p-5 sm:p-6", isPending && "opacity-70")}>
      <h3 className="text-h2 text-foreground">{FACILITY_LABEL[facility]}</h3>

      <div className="mt-4 space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted">No rows yet — add one below.</p>
        )}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => update(row.id, { label: e.target.value })}
              maxLength={24}
              placeholder="Label"
              aria-label="Detail label"
              className="input w-28 shrink-0"
            />
            <input
              value={row.value}
              onChange={(e) => update(row.id, { value: e.target.value })}
              maxLength={60}
              placeholder="Value"
              aria-label="Detail value"
              className="input"
            />
            <button
              type="button"
              onClick={() => remove(row.id)}
              aria-label="Remove row"
              className="btn btn-outline btn-sm shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={rows.length >= MAX_DETAILS}
          className="btn btn-outline btn-sm"
        >
          Add row
        </button>
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
  );
}
