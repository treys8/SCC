"use client";

import { useActionState } from "react";
import {
  updateDepartmentPreferences,
  type ProfileState,
} from "@/app/(app)/profile/actions";
import { SubmitButton } from "@/components/submit-button";
import { DEPARTMENTS } from "@/lib/constants";
import type { DepartmentType } from "@/lib/database.types";

const INITIAL: ProfileState = {};

/**
 * Lets a member pick which departments may alert them. `selected` is their
 * current opt-ins (server-fetched). Submitting replaces the whole set, so an
 * unchecked box opts out. Safety alerts (lightning / closures) bypass these
 * choices, which the hint below makes explicit.
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
  const current = new Set(selected);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div>
        <h2 className="text-h2">Alert preferences</h2>
        <p className="field-hint">
          Choose which departments can notify you. Urgent safety alerts — like a
          lightning hold or a closure — always come through.
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
              defaultChecked={current.has(dept.value)}
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
