"use client";

import { useActionState } from "react";
import {
  setPassword,
  type SetPasswordState,
} from "@/app/set-password/actions";
import { SubmitButton } from "@/components/submit-button";

const INITIAL: SetPasswordState = {};

export function SetPasswordForm() {
  const [state, formAction] = useActionState(setPassword, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="input"
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label className="label" htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="input"
        />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton className="w-full" pendingText="Saving…">
        Set password &amp; continue
      </SubmitButton>
    </form>
  );
}
