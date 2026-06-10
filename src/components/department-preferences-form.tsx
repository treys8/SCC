"use client";

import { useActionState, useState } from "react";
import {
  updateDepartmentPreferences,
  type ProfileState,
} from "@/app/(app)/profile/actions";
import { SubmitButton } from "@/components/submit-button";
import { DEPARTMENTS } from "@/lib/constants";
import type { DepartmentType } from "@/lib/database.types";

const INITIAL: ProfileState = {};

/**
 * Lets a member pick which departments may alert them. Alerts are on by default:
 * a member with no saved preferences receives everything, so we show every box
 * checked and let them uncheck to opt out. `selected` is their saved opt-ins;
 * empty means "never configured" → default-on. Safety alerts (lightning /
 * closures) bypass these choices, which the hint makes explicit.
 *
 * Controlled (useState) so a server-side error doesn't reset the boxes — React
 * 19 wipes uncontrolled fields after a form action returns.
 */
export function DepartmentPreferencesForm({
  selected,
}: {
  selected: DepartmentType[];
}) {
  const [state, formAction] = useActionState(
    updateDepartmentPreferences,
    INITIAL,
  );
  const [checked, setChecked] = useState<Set<DepartmentType>>(
    () =>
      new Set(
        selected.length ? selected : DEPARTMENTS.map((d) => d.value),
      ),
  );

  const toggle = (value: DepartmentType, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(value);
      else next.delete(value);
      return next;
    });

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div>
        <h2 className="text-h2">Alert preferences</h2>
        <p className="field-hint">
          You&rsquo;re set to hear from every department. Uncheck any you&rsquo;d
          rather not be notified about. Urgent safety alerts — like a lightning
          hold or a closure — always come through.
        </p>
      </div>

      <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DEPARTMENTS.map((dept) => (
          <label
            key={dept.value}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <input
              type="checkbox"
              name="department"
              value={dept.value}
              checked={checked.has(dept.value)}
              onChange={(e) => toggle(dept.value, e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">{dept.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">Save preferences</SubmitButton>
        {state.success && <span className="text-sm text-success">Saved.</span>}
        {state.error && (
          <span className="text-sm text-danger">{state.error}</span>
        )}
      </div>
    </form>
  );
}
