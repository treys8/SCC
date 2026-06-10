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

const IMAGE_EXTS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "heif",
  "avif",
  "bmp",
  "tif",
  "tiff",
];
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

// The `posts` bucket now enforces an allowed_mime_types list server-side, so we
// must always send a concrete content-type — some browsers leave File.type empty
// for HEIC/csv, which would otherwise be rejected. Keyed by the extensions we
// accept (see IMAGE_EXTS / FILE_EXTS).
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
};

/** A concrete content-type for the upload, falling back to the file extension. */
function contentTypeFor(file: File): string {
  // Some browsers/files report the non-standard "image/jpg"; the bucket
  // allow-list (and the world) uses "image/jpeg".
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
  return type || MIME_BY_EXT[ext(file.name)] || "application/octet-stream";
}

// Must mirror the posts bucket's allowed_mime_types so the composer rejects an
// unsupported file up front with a clear message instead of letting Storage
// reject it with an opaque error. SVG is intentionally excluded (XSS risk).
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/bmp",
  "image/tiff",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

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
  // Aligns with the bucket's server-side allow-list so e.g. an SVG (offered by
  // the image/* picker) fails here with a clear message, not opaquely later.
  if (!ALLOWED_MIME.has(contentTypeFor(file))) {
    return `${file.name}: unsupported file type`;
  }
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
  opts: { probe?: boolean } = {},
): Promise<NewAttachmentMeta> {
  const { probe = true } = opts;
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  const supabase = createClient();
  const kind = classifyFile(file)!;
  const e = ext(file.name) || (kind === "image" ? "jpg" : "bin");
  const path = `${userId}/${crypto.randomUUID()}.${e}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: contentTypeFor(file),
    upsert: false,
  });
  if (error) throw new Error(`Couldn't upload ${file.name}: ${error.message}`);

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  let width: number | null = null;
  let height: number | null = null;
  if (probe && kind === "image") {
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

// HEIC/HEIF (the iPhone camera default) is accepted as an "image" but next/image
// can't optimize it — the cover would render broken for non-Safari members.
function isHeic(file: File): boolean {
  const e = ext(file.name);
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    e === "heic" ||
    e === "heif"
  );
}

/**
 * Upload an event cover photo (images only) and return its public URL.
 * Reuses the `posts` bucket and per-user folder convention so Storage RLS and
 * next/image's allowlist keep working unchanged. Events store only the URL —
 * a replaced or deleted cover simply orphans the old object, which is fine at
 * club scale. Skips the dimension probe since the cover crops to a fixed ratio.
 */
export async function uploadEventCover(
  file: File,
  userId: string,
): Promise<string> {
  if (classifyFile(file) !== "image") {
    throw new Error(`${file.name}: cover must be an image`);
  }
  if (isHeic(file)) {
    throw new Error(
      "HEIC photos aren't supported here — please choose a JPEG or PNG.",
    );
  }
  const meta = await uploadPostFile(file, userId, { probe: false });
  return meta.url;
}
