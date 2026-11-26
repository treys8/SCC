import type { Metadata } from "next";
import Link from "next/link";
import { InviteMemberForm } from "@/components/invite-member-form";
import { MembersTable } from "@/components/members-table";
import { PageHeader } from "@/components/page-header";
import { isAdmin, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AccountSummary, MemberWithTitle } from "@/lib/database.types";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const me = await requireRole("staff", "admin");
  const admin = isAdmin(me.role);
  const supabase = await createClient();

  const [{ data: members }, { data: titles }, { data: accountRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*, title:staff_titles(name)")
        .order("full_name", { ascending: true }),
      supabase.from("staff_titles").select("*").order("name"),
      supabase
        .from("accounts")
        .select(
          "account_number, created_at, created_by, profiles!profiles_account_number_fkey(full_name)",
        )
        .order("account_number"),
    ]);

  // Who's already on each account — drives the invite form's
  // new-vs-existing hint so a typo'd number doesn't silently fork an account.
  const accounts: AccountSummary[] = (accountRows ?? []).map((a) => ({
    account_number: a.account_number,
    created_at: a.created_at,
    created_by: a.created_by,
    member_names: a.profiles.map((p) => p.full_name),
  }));

  // Who has written something that "Remove" would cascade away — they only
  // get Deactivate. Admin-only (only admins see row actions), read with the
  // service role so drafts and the course log count too. removeMember
  // re-checks server-side; this just doesn't offer a button that would refuse.
  const authorIds = admin ? await fetchAuthorIds() : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Members"
        description={
          admin
            ? "Invite new members, assign account numbers, and manage roles."
            : "Invite new members and assign account numbers."
        }
        action={
          <Link href="/members/import" className="btn btn-outline btn-sm">
            Import from CSV
          </Link>
        }
      />
      <InviteMemberForm isAdmin={admin} titles={titles ?? []} accounts={accounts} />
      <MembersTable
        members={(members ?? []) as MemberWithTitle[]}
        currentUserId={me.id}
        isAdmin={admin}
        authorIds={authorIds}
      />
    </div>
  );
}

async function fetchAuthorIds(): Promise<string[]> {
  const db = createAdminClient();
  const results = await Promise.all(
    (["posts", "golf_log_entries", "golf_log_comments"] as const).map((t) =>
      db.from(t).select("author_id"),
    ),
  );
  const ids = new Set<string>();
  for (const { data } of results) {
    for (const row of data ?? []) ids.add(row.author_id);
  }
  return [...ids];
}
