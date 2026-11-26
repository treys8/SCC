"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deactivateMember,
  reactivateMember,
  removeMember,
  setMemberAccount,
  setMemberRole,
} from "@/app/(app)/members/actions";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/cn";
import { ROLE_LABEL, ROLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { MemberWithTitle, UserRole } from "@/lib/database.types";

export function MembersTable({
  members,
  currentUserId,
  isAdmin,
  authorIds = [],
}: {
  members: MemberWithTitle[];
  currentUserId: string;
  isAdmin: boolean;
  /** Profiles with posts / log entries: Remove would delete those, so they
   * only get Deactivate. */
  authorIds?: string[];
}) {
  const authors = new Set(authorIds);
  const [pending, startTransition] = useTransition();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountDraft, setAccountDraft] = useState("");
  const router = useRouter();

  function changeRole(id: string, role: UserRole) {
    startTransition(async () => {
      try {
        await setMemberRole(id, role);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not update role.");
      }
    });
  }

  /** Run a members action that reports refusals as a returned value. */
  function run(action: () => Promise<{ error?: string }>, fallback: string) {
    startTransition(async () => {
      try {
        const { error } = await action();
        if (error) {
          alert(error);
          return;
        }
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : fallback);
      }
    });
  }

  function remove(id: string, name: string) {
    if (
      !confirm(
        `Remove ${name}? This permanently deletes their account and cannot be undone.`,
      )
    )
      return;
    run(() => removeMember(id), "Could not remove member.");
  }

  function deactivate(id: string, name: string) {
    if (
      !confirm(
        `Deactivate ${name}? They'll be signed out and can't sign in. Their posts stay up, credited to "Former staff", and their title is freed for someone else.`,
      )
    )
      return;
    run(() => deactivateMember(id), "Could not deactivate.");
  }

  function reactivate(id: string) {
    run(() => reactivateMember(id), "Could not reactivate.");
  }

  // Render helper: the admin-only row actions (never on your own row).
  function rowActions(m: MemberWithTitle) {
    if (!isAdmin || m.id === currentUserId) return null;
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => deactivate(m.id, m.full_name)}
          disabled={pending}
          className="btn btn-ghost btn-sm"
        >
          Deactivate
        </button>
        {!authors.has(m.id) && (
          <button
            type="button"
            onClick={() => remove(m.id, m.full_name)}
            disabled={pending}
            className="btn btn-ghost btn-sm text-danger hover:bg-danger/10"
          >
            Remove
          </button>
        )}
      </span>
    );
  }

  function saveAccount(id: string) {
    const value = accountDraft.trim();
    startTransition(async () => {
      try {
        await setMemberAccount(id, value === "" ? null : value);
        setEditingAccountId(null);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not update the account.");
      }
    });
  }

  // Render helper (not a component) so the control reconciles in place instead
  // of remounting each render.
  function roleControl(m: MemberWithTitle) {
    if (!isAdmin || m.id === currentUserId) {
      return <span className="text-foreground">{ROLE_LABEL[m.role]}</span>;
    }
    return (
      <select
        className="select max-w-36"
        value={m.role}
        disabled={pending}
        onChange={(e) => changeRole(m.id, e.target.value as UserRole)}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
    );
  }

  // Members show their (editable) account number; staff/admin show their title.
  function accountControl(m: MemberWithTitle) {
    if (m.role !== "member") {
      return <span className="text-muted">{m.title?.name ?? "—"}</span>;
    }
    if (editingAccountId === m.id) {
      return (
        <span className="inline-flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{1,5}"
            maxLength={5}
            className="input max-w-24"
            value={accountDraft}
            disabled={pending}
            autoFocus
            onChange={(e) => setAccountDraft(e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveAccount(m.id);
              }
              if (e.key === "Escape") setEditingAccountId(null);
            }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pending}
            onClick={() => saveAccount(m.id)}
          >
            Save
          </button>
        </span>
      );
    }
    return (
      <button
        type="button"
        className="text-foreground underline-offset-4 hover:underline"
        title="Change account number"
        onClick={() => {
          setEditingAccountId(m.id);
          setAccountDraft(m.account_number ?? "");
        }}
      >
        {m.account_number ? `#${m.account_number}` : "Assign"}
      </button>
    );
  }

  const active = members.filter((m) => !m.deactivated_at);
  const deactivated = members.filter((m) => m.deactivated_at);

  if (members.length === 0) {
    return (
      <EmptyState
        title="No members yet"
        description="Invited members will appear here once they're added."
      />
    );
  }

  return (
    <>
      {/* Mobile: stacked cards (no horizontal scroll). */}
      <div className="space-y-3 md:hidden">
        {active.map((m) => {
          const isSelf = m.id === currentUserId;
          return (
            <div
              key={m.id}
              className={cn("card p-4", pending && "opacity-60")}
            >
              <div className="font-medium text-foreground">
                {m.full_name}
                {isSelf && <span className="ml-2 text-caption text-muted">(you)</span>}
              </div>
              <div className="text-sm text-muted">{m.email}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">
                  {m.role === "member" ? "Account" : "Title"}
                </dt>
                <dd className="text-foreground">{accountControl(m)}</dd>
                <dt className="text-muted">Phone</dt>
                <dd className="text-foreground">{m.phone ?? "—"}</dd>
                <dt className="text-muted">Joined</dt>
                <dd className="text-foreground">
                  {formatDate(m.created_at.slice(0, 10))}
                </dd>
              </dl>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                {roleControl(m)}
                {rowActions(m)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: full table. */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-caption uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Account / Title</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {active.map((m) => {
              const isSelf = m.id === currentUserId;
              return (
                <tr key={m.id} className={pending ? "opacity-60" : undefined}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {m.full_name}
                      {isSelf && (
                        <span className="ml-2 text-caption text-muted">(you)</span>
                      )}
                    </div>
                    <div className="text-caption text-muted">{m.email}</div>
                  </td>
                  <td className="px-4 py-3">{accountControl(m)}</td>
                  <td className="px-4 py-3 text-muted">{m.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(m.created_at.slice(0, 10))}
                  </td>
                  <td className="px-4 py-3">
                    {roleControl(m)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {rowActions(m)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {deactivated.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Deactivated ({deactivated.length})
          </summary>
          <ul className="mt-3 divide-y divide-border">
            {deactivated.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 py-3",
                  pending && "opacity-60",
                )}
              >
                <div>
                  <div className="font-medium text-foreground">{m.full_name}</div>
                  <div className="text-caption text-muted">
                    {m.email} · {ROLE_LABEL[m.role]} · deactivated{" "}
                    {formatDate(m.deactivated_at!.slice(0, 10))}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => reactivate(m.id)}
                    disabled={pending}
                    className="btn btn-outline btn-sm"
                  >
                    Reactivate
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
