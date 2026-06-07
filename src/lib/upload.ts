/**
 * Client-side upload helpers for the feed composer.
 *
 * Files go straight from the browser to the public `posts` Storage bucket
 * (Server Actions cap request bodies at ~1MB, far too small for phone photos).
 * Storage RLS only lets a user write under their own `<uid>/` folder, so every
 * path is prefixed with the uploader's id. Only the resulting metadata is then
 * sent to the `createPost` / `updatePost` Server Actions.
 *
 * Browser-only (uses `Image`, `URL`, `crypto`). Import the metadata *type* into
 * server code with `import type` so none of this module is bundled there.
 */
import { createClient } from "@/lib/supabase/client";
import type { AttachmentKind } from "@/lib/database.types";

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const BUCKET = "posts";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
const FILE_EXTS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
];

/** What the composer collects per file and hands to the Server Action. */
export type NewAttachmentMeta = {
  kind: AttachmentKind;
  url: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
};

/** `accept` attribute for the file <input>. */
export const ACCEPT_ATTR =
  "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Decide whether a file is an image, a document, or unsupported. */
export function classifyFile(file: File): AttachmentKind | null {
  if (file.type.startsWith("image/")) return "image";
  const e = ext(file.name);
  if (IMAGE_EXTS.includes(e)) return "image";
  if (FILE_EXTS.includes(e)) return "file";
  if (file.type === "application/pdf") return "file";
  return null;
}

/** Returns a human-readable error, or null if the file is acceptable. */
export function validateFile(file: File): string | null {
  if (classifyFile(file) === null) return `${file.name}: unsupported file type`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 25 MB`;
  return null;
}

/**
 * Best-effort read of an image's natural dimensions, used to reserve aspect
 * ratio in the gallery. Resolves null when the browser can't decode the image
 * (e.g. some iPhone HEIC files) — the gallery falls back to a default ratio.
 */
function probeImageSize(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Upload one file and return its attachment metadata. Throws on validation or
 * upload failure so the caller can show a per-file error.
 */
export async function uploadPostFile(
  file: File,
  userId: string,
): Promise<NewAttachmentMeta> {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  const supabase = createClient();
  const kind = classifyFile(file)!;
  const e = ext(file.name) || (kind === "image" ? "jpg" : "bin");
  const path = `${userId}/${crypto.randomUUID()}.${e}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Couldn't upload ${file.name}: ${error.message}`);

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  let width: number | null = null;
  let height: number | null = null;
  if (kind === "image") {
    const size = await probeImageSize(file);
    if (size) {
      width = size.width;
      height = size.height;
    }
  }

  return {
    kind,
    url,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    width,
    height,
  };
}
