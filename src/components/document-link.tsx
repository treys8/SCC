import { formatFileSize } from "@/lib/format";
import type { DocumentRow } from "@/lib/database.types";

/**
 * One downloadable document, rendered as a list item. Shared by the Documents
 * library and the Dining/Pool pages (which surface their menu/pool PDFs inline).
 * Caller wraps these in a `<ul className="rule-list">` (hairline rows).
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
        className="group flex items-center gap-4 py-4"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/40 text-2xs font-semibold tracking-[0.08em] text-gold-ink">
          {fileExt(doc.file_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-lg text-foreground transition-colors group-hover:text-primary">
            {doc.title}
          </span>
          {meta && <span className="block text-caption text-muted">{meta}</span>}
        </span>
        <span
          aria-hidden
          className="pr-1 text-gold-ink transition-transform group-hover:translate-y-0.5"
        >
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
