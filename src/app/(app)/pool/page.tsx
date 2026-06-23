import type { Metadata } from "next";
import { DocumentLink } from "@/components/document-link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PoolStatus } from "@/components/pool/pool-status";
import { SectionsView } from "@/components/sections-view";
import { requireProfile } from "@/lib/auth";
import { fetchFacilityStatus } from "@/lib/facility";
import { createClient } from "@/lib/supabase/server";
import type { PageSection } from "@/lib/database.types";

export const metadata: Metadata = { title: "Pool" };

/**
 * Member-facing Pool destination: today's live pool status, staff-written info
 * sections (hours, season, guest policy…), and any pool PDFs from the document
 * library. Read-only — staff edit sections at /manage/pool and status at
 * /manage/conditions.
 */
export default async function PoolPage() {
  await requireProfile();
  const supabase = await createClient();

  const [facilities, sectionsRes, poolDocsRes] = await Promise.all([
    fetchFacilityStatus(supabase),
    supabase
      .from("page_sections")
      .select("*")
      .eq("page", "pool")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("documents")
      .select("*")
      .eq("category", "pool")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  const sections = (sectionsRes.data ?? []) as PageSection[];
  const poolDocs = poolDocsRes.data ?? [];
  const hasPool = facilities.some((f) => f.facility === "pool");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pool"
        description="Hours, guest policy, and today's pool status."
      />

      {hasPool && (
        <section className="space-y-3">
          <h2 className="text-h2 text-foreground">Today at the pool</h2>
          <PoolStatus initial={facilities} />
        </section>
      )}

      <SectionsView sections={sections} />

      {poolDocs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-foreground">Pool documents</h2>
          <ul className="space-y-2">
            {poolDocs.map((doc) => (
              <DocumentLink key={doc.id} doc={doc} />
            ))}
          </ul>
        </section>
      )}

      {sections.length === 0 && poolDocs.length === 0 && (
        <EmptyState
          title="Pool details coming soon"
          description="Hours, the season, and guest rules will appear here once staff add them."
        />
      )}
    </div>
  );
}
