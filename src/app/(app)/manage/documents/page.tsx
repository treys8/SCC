import type { Metadata } from "next";
import { DocumentsEditor } from "@/components/documents-editor";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documents" };

/**
 * Documents console. Staff see every document (published or staged); the
 * member-facing /documents page shows only published ones. Gated by /manage.
 */
export default async function ManageDocumentsPage() {
  const profile = await requireRole("staff", "admin");
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("documents")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Publish menus, pool info, and newsletters for members to view and download."
      />
      <DocumentsEditor initial={docs ?? []} userId={profile.id} />
    </div>
  );
}
