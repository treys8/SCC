"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { inviteMember, type InviteState } from "@/app/(app)/members/actions";
import { SubmitButton } from "@/components/submit-button";
import { DEPARTMENT_LABEL, ROLE_LABEL, ROLES } from "@/lib/constants";
import type { AccountSummary, StaffTitle, UserRole } from "@/lib/database.types";

const INITIAL: InviteState = {};

export function InviteMemberForm({
  isAdmin,
  titles,
  accounts,
}: {
  isAdmin: boolean;
  titles: StaffTitle[];
  accounts: AccountSummary[];
}) {
  const [state, formAction] = useActionState(inviteMember, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  // Staff invite members only; admins can also create staff/admin logins.
  const [role, setRole] = useState<UserRole>("member");
  const [accountNumber, setAccountNumber] = useState("");

  // Clear the controlled fields during render when a new invite succeeds.
  const [lastSuccess, setLastSuccess] = useState<string | undefined>();
  if (state.success !== lastSuccess) {
    setLastSuccess(state.success);
    if (state.success) {
      setRole("member");
      setAccountNumber("");
    }
  }

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  const existing =
    /^[0-9]{1,5}$/.test(accountNumber) &&
    accounts.find((a) => a.account_number === accountNumber);
  const accountHint = !/^[0-9]{1,5}$/.test(accountNumber)
    ? null
    : existing
      ? `Joins existing account #${accountNumber}${
          existing.member_names.length > 0
            ? ` — ${existing.member_names.join(", ")}`
            : ""
        }`
      : `New account #${accountNumber} will be created.`;

  return (
    <form ref={formRef} action={formAction} className="card p-6">
      <h2 className="text-h2 text-foreground">Invite a member</h2>
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
        {isAdmin && (
          <div>
            <label className="label" htmlFor="invite_role">
              Role
            </label>
            <select
              id="invite_role"
              name="role"
              className="select"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        )}
        {role === "member" ? (
          <div>
            <label className="label" htmlFor="invite_account">
              Account number
            </label>
            <input
              id="invite_account"
              name="account_number"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{1,5}"
              maxLength={5}
              required
              className="input"
              placeholder="00123"
              list="invite_account_options"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.trim())}
            />
            <datalist id="invite_account_options">
              {accounts.map((a) => (
                <option key={a.account_number} value={a.account_number}>
                  {a.member_names.join(", ")}
                </option>
              ))}
            </datalist>
            {accountHint && (
              <p className="mt-1 text-caption text-muted">{accountHint}</p>
            )}
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="invite_title">
              Staff title
            </label>
            <select id="invite_title" name="title_id" className="select" defaultValue="">
              <option value="">No title</option>
              {titles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({DEPARTMENT_LABEL[t.department]})
                </option>
              ))}
            </select>
          </div>
        )}
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
