import type { Metadata } from "next";
import Link from "next/link";
import { RosterImport } from "@/components/members/roster-import";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Import members" };

export default async function ImportMembersPage() {
  await requireRole("staff", "admin");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Import members"
        description="Bulk-invite members from a CSV export. Everyone with an email gets an invitation to set a password and join the portal."
        action={
          <Link href="/members" className="btn btn-outline btn-sm">
            Back to members
          </Link>
        }
      />
      <RosterImport />
    </div>
  );
}
