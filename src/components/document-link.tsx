import { formatFileSize } from "@/lib/format";
import type { DocumentRow } from "@/lib/database.types";

/**
 * One downloadable document, rendered as a list item. Shared by the Documents
 * library and the Dining/Pool pages (which surface their menu/pool PDFs inline).
 * Caller wraps these in a <ul>.
 */
export function DocumentLink({ doc }: { doc: DocumentRow }) {
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
