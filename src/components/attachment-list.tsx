import { formatFileSize } from "@/lib/format";
import type { PostAttachment } from "@/lib/database.types";

const EXT_STYLES: Record<string, string> = {
  PDF: "bg-danger/10 text-danger",
  DOC: "bg-sky-100 text-sky-700",
  DOCX: "bg-sky-100 text-sky-700",
  XLS: "bg-success/10 text-success",
  XLSX: "bg-success/10 text-success",
  CSV: "bg-success/10 text-success",
  PPT: "bg-accent/15 text-accent-600",
  PPTX: "bg-accent/15 text-accent-600",
  TXT: "bg-foreground/5 text-muted",
};

function ext(name: string | null): string {
  if (name && name.includes(".")) {
    return name.split(".").pop()!.toUpperCase().slice(0, 4);
  }
  return "FILE";
}

/** Document attachments rendered as tappable chips with type + size. */
export function AttachmentList({ files }: { files: PostAttachment[] }) {
  if (files.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2">
      {files.map((file) => {
        const label = ext(file.file_name);
        const size = formatFileSize(file.size_bytes);
        return (
          <li key={file.id}>
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-2.5 transition-colors hover:bg-background"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                  EXT_STYLES[label] ?? "bg-foreground/5 text-muted"
                }`}
              >
                {label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {file.file_name ?? "Attachment"}
                </span>
                {size && (
                  <span className="block text-xs text-muted">{size}</span>
                )}
              </span>
              <span aria-hidden className="pr-1 text-muted">
                ↓
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
