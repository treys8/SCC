"use client";

import { useActionState, useState } from "react";
import { updateProfile, type ProfileState } from "@/app/(app)/profile/actions";
import { SubmitButton } from "@/components/submit-button";
import type { Profile } from "@/lib/database.types";

const INITIAL: ProfileState = {};

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updateProfile, INITIAL);
  // Controlled so a server-side validation error doesn't wipe what the member
  // typed: React 19 resets uncontrolled (defaultValue) fields after a form
  // action returns. (Same reason event-form.tsx is controlled.)
  const [fullName, setFullName] = useState(profile.full_name);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

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
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="display_name">
          Preferred name <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="input"
          placeholder="e.g. Trey"
        />
        <p className="field-hint">
          What we&rsquo;ll call you in greetings. Defaults to your full name.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
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
