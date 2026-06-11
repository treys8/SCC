import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { formatFileSize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/database.types";

export const metadata: Metadata = { title: "Menus & Docs" };

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
        title="Menus & Documents"
        description="Club menus, pool info, and newsletters to view or download."
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
                    <DocItem key={doc.id} doc={doc} />
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

function DocItem({ doc }: { doc: DocumentRow }) {
  const size = formatFileSize(doc.size_bytes);
  const meta = [doc.file_name, size].filter(Boolean).join(" · ");
  return (
    <li>
      <a
        href={doc.file_url}
        target="_blank"
        rel="noreferrer"
        className="card flex items-center gap-3 p-3 transition-colors hover:bg-surface-2"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-2xs font-bold text-primary">
          {fileExt(doc.file_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">
            {doc.title}
          </span>
          {meta && <span className="block text-caption text-muted">{meta}</span>}
        </span>
        <span aria-hidden className="pr-1 text-muted">
          ↓
        </span>
      </a>
    </li>
  );
}

function fileExt(name: string | null): string {
  if (name && name.includes(".")) {
    return name.split(".").pop()!.toUpperCase().slice(0, 4);
  }
  return "FILE";
}
