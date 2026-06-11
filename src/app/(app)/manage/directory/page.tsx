import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { StaffDirectoryEditor } from "@/components/staff-directory-editor";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff directory" };

/** Staff editor for the member-facing /directory. Gated by the /manage layout. */
export default async function ManageDirectoryPage() {
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("staff_directory")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff directory"
        description="Names, titles, and contact info shown on the member Directory page. Lower sort order shows first."
      />
      <StaffDirectoryEditor initial={staff ?? []} />
    </div>
  );
}
