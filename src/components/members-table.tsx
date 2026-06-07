"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMember, setMemberRole } from "@/app/(app)/members/actions";
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

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
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
                        <span className="ml-2 text-xs text-muted">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-muted">{m.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{m.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(m.created_at.slice(0, 10))}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className="text-foreground">
                        {ROLE_LABEL[m.role]}
                      </span>
                    ) : (
                      <select
                        className="select max-w-32"
                        value={m.role}
                        disabled={pending}
                        onChange={(e) =>
                          changeRole(m.id, e.target.value as UserRole)
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    )}
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
  );
}
