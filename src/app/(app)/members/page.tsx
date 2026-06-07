import type { Metadata } from "next";
import { InviteMemberForm } from "@/components/invite-member-form";
import { MembersTable } from "@/components/members-table";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const me = await requireRole("admin");
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Members"
        description="Invite new members and manage roles."
      />
      <InviteMemberForm />
      <MembersTable members={members ?? []} currentUserId={me.id} />
    </div>
  );
}
