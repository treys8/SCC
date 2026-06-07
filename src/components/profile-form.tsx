"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/app/(app)/profile/actions";
import { SubmitButton } from "@/components/submit-button";
import type { Profile } from "@/lib/database.types";

const INITIAL: ProfileState = {};

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updateProfile, INITIAL);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="full_name">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          defaultValue={profile.full_name}
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={profile.phone ?? ""}
          className="input"
          placeholder="(662) 555-0100"
        />
      </div>

      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={profile.email}
          readOnly
          disabled
          className="input bg-surface-2 text-muted"
        />
        <p className="field-hint">
          Contact club staff if your email needs to change.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        {state.success && (
          <span className="text-sm text-success">Saved.</span>
        )}
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
