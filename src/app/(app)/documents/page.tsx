import type { Metadata } from "next";
import { DocumentLink } from "@/components/document-link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documents" };

/**
 * Member-facing document library — menus, pool info, and newsletters published
 * by staff, grouped by category. Read-only; staff publish via /manage/documents.
 */
export default async function DocumentsPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const docs = data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Pool info, newsletters, forms, and menu PDFs to view or download."
      />
      {docs.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Menus and documents will appear here once staff post them."
        />
      ) : (
        <div className="space-y-8">
          {DOCUMENT_CATEGORIES.map((cat) => {
            const inCat = docs.filter((d) => d.category === cat.value);
            if (inCat.length === 0) return null;
            return (
              <section key={cat.value} className="space-y-3">
                <h2 className="text-h2 text-foreground">{cat.label}</h2>
                <ul className="space-y-2">
                  {inCat.map((doc) => (
                    <DocumentLink key={doc.id} doc={doc} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
