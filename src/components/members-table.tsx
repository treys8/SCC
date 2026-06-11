"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMember, setMemberRole } from "@/app/(app)/members/actions";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/cn";
import { ROLE_LABEL, ROLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Profile, UserRole } from "@/lib/database.types";

export function MembersTable({
  members,
  currentUserId,
}: {
  members: Profile[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
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

  function remove(id: string, name: string) {
    if (
      !confirm(
        `Remove ${name}? This permanently deletes their account and cannot be undone.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        await removeMember(id);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not remove member.");
      }
    });
  }

  // Render helper (not a component) so the control reconciles in place instead
  // of remounting each render.
  function roleControl(m: Profile) {
    if (m.id === currentUserId) {
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
        {members.map((m) => {
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
                <dt className="text-muted">Phone</dt>
                <dd className="text-foreground">{m.phone ?? "—"}</dd>
                <dt className="text-muted">Joined</dt>
                <dd className="text-foreground">
                  {formatDate(m.created_at.slice(0, 10))}
                </dd>
              </dl>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                {roleControl(m)}
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => remove(m.id, m.full_name)}
                    disabled={pending}
                    className="btn btn-ghost btn-sm text-danger hover:bg-danger/10"
                  >
                    Remove
                  </button>
                )}
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
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => {
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
                  <td className="px-4 py-3 text-muted">{m.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(m.created_at.slice(0, 10))}
                  </td>
                  <td className="px-4 py-3">
                    {roleControl(m)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => remove(m.id, m.full_name)}
                        disabled={pending}
                        className="btn btn-ghost btn-sm text-danger hover:bg-danger/10"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
