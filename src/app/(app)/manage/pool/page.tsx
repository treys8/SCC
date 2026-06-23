import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SectionsEditor } from "@/components/sections-editor";
import { createClient } from "@/lib/supabase/server";
import type { PageSection } from "@/lib/database.types";

export const metadata: Metadata = { title: "Pool page" };

/**
 * Staff editor for the member Pool page's content sections (hours, season, guest
 * rules…). Live pool status is set under Conditions; pool PDFs under Documents.
 * Gated by the /manage layout.
 */
export default async function ManagePoolPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("page_sections")
    .select("*")
    .eq("page", "pool")
    .order("sort_order", { ascending: true });
  const sections = (data ?? []) as PageSection[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pool page"
        description="Sections members see on the Pool page. Drafts stay hidden until you publish them."
      />
      <SectionsEditor page="pool" sections={sections} />
      <p className="text-sm text-muted">
        Also set the{" "}
        <Link
          href="/manage/conditions"
          className="font-medium text-primary hover:underline"
        >
          live pool status
        </Link>{" "}
        and upload{" "}
        <Link
          href="/manage/documents"
          className="font-medium text-primary hover:underline"
        >
          pool PDFs
        </Link>
        .
      </p>
    </div>
  );
}
