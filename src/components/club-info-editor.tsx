"use client";

import { useActionState } from "react";
import {
  type ClubInfoState,
  saveClubInfo,
} from "@/app/(app)/manage/club-info/actions";
import { SubmitButton } from "@/components/submit-button";
import type { ClubInfo } from "@/lib/database.types";

const INITIAL: ClubInfoState = {};

/** Single-form editor for the club_info singleton. */
export function ClubInfoEditor({ initial }: { initial: ClubInfo }) {
  const [state, formAction] = useActionState(saveClubInfo, INITIAL);

  return (
    <form action={formAction} className="card space-y-4 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="street_address"
          label="Street address"
          defaultValue={initial.street_address}
        />
        <Field name="city" label="City" defaultValue={initial.city} />
        <Field name="state" label="State" defaultValue={initial.state} />
        <Field name="postal_code" label="ZIP" defaultValue={initial.postal_code} />
        <Field
          name="phone"
          label="Phone"
          type="tel"
          defaultValue={initial.phone}
        />
        <Field
          name="email"
          label="Email"
          type="email"
          defaultValue={initial.email}
        />
        <Field
          name="mailing_address"
          label="Mailing address"
          defaultValue={initial.mailing_address}
        />
        <Field
          name="website"
          label="Website"
          type="url"
          defaultValue={initial.website}
          placeholder="https://"
        />
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-success">{state.success}</p>}

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input"
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
      />
    </label>
  );
}
