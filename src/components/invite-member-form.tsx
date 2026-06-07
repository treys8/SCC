"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteMember, type InviteState } from "@/app/(app)/members/actions";
import { SubmitButton } from "@/components/submit-button";
import { ROLE_LABEL, ROLES } from "@/lib/constants";

const INITIAL: InviteState = {};

export function InviteMemberForm() {
  const [state, formAction] = useActionState(inviteMember, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="card p-6">
      <h2 className="font-serif text-lg font-semibold text-foreground">
        Invite a member
      </h2>
      <p className="mt-1 text-sm text-muted">
        They&apos;ll receive an email to set a password and join the portal.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="invite_name">
            Full name
          </label>
          <input
            id="invite_name"
            name="full_name"
            type="text"
            required
            className="input"
            placeholder="Jane Member"
          />
        </div>
        <div>
          <label className="label" htmlFor="invite_email">
            Email
          </label>
          <input
            id="invite_email"
            name="email"
            type="email"
            required
            className="input"
            placeholder="jane@example.com"
          />
        </div>
        <div>
          <label className="label" htmlFor="invite_role">
            Role
          </label>
          <select id="invite_role" name="role" className="select" defaultValue="member">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <SubmitButton pendingText="Sending…">Send invitation</SubmitButton>
        {state.success && (
          <span className="text-sm text-success">{state.success}</span>
        )}
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
