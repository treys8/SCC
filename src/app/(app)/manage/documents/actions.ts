"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { documentsObjectUrl, documentsPublicUrl } from "@/lib/url";
import type { DocumentCategory, DocumentRow } from "@/lib/database.types";

const VALID_CATEGORY = new Set<string>([
  "menu",
  "pool",
  "newsletter",
  "form",
  "general",
]);
const TITLE_MAX = 120;

/** What the client collects after a browser-direct upload to the documents bucket. */
export type DocumentFileInput = {
  url: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

function revalidateDocuments() {
  revalidatePath("/manage/documents");
  revalidatePath("/documents");
}

/** Trust only a same-origin documents-bucket URL; else re-derive from the path. */
function safeFileUrl(url: string, storagePath: string): string | null {
  return documentsPublicUrl(url) ?? documentsObjectUrl(storagePath);
}

const cleanSort = (n: number) => (Number.isFinite(n) ? Math.trunc(n) : 0);
const cleanCategory = (c: string): DocumentCategory =>
  (VALID_CATEGORY.has(c) ? c : "general") as DocumentCategory;

export async function createDocument(input: {
  title: string;
  category: DocumentCategory;
  is_published: boolean;
  sort_order: number;
  file: DocumentFileInput;
}): Promise<DocumentRow> {
  const profile = await requireRole("staff", "admin");

  const title = input.title.trim().slice(0, TITLE_MAX);
  if (!title) throw new Error("A title is required.");

  const url = safeFileUrl(input.file.url, input.file.storage_path);
  if (!url || !input.file.storage_path) {
    throw new Error("The uploaded file is invalid.");
  }
  const isImage = (input.file.mime_type ?? "").startsWith("image/");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      title,
      category: cleanCategory(input.category),
      file_url: url,
      storage_path: input.file.storage_path,
      file_name: input.file.file_name || null,
      mime_type: input.file.mime_type || null,
      size_bytes: Number.isFinite(input.file.size_bytes)
        ? input.file.size_bytes
        : null,
      cover_image_url: isImage ? url : null,
      is_published: Boolean(input.is_published),
      sort_order: cleanSort(input.sort_order),
      created_by: profile.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidateDocuments();
  return data;
}

export async function updateDocumentMeta(input: {
  id: string;
  title: string;
  category: DocumentCategory;
  is_published: boolean;
  sort_order: number;
}): Promise<void> {
  await requireRole("staff", "admin");

  const title = input.title.trim().slice(0, TITLE_MAX);
  if (!title) throw new Error("A title is required.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .update({
      title,
      category: cleanCategory(input.category),
      is_published: Boolean(input.is_published),
      sort_order: cleanSort(input.sort_order),
    })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That document no longer exists.");
  revalidateDocuments();
}

export async function deleteDocument(id: string): Promise<void> {
  await requireRole("staff", "admin");
  const supabase = await createClient();

  // Grab the storage path first so we can best-effort remove the object too.
  const { data: row } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // Best-effort: own-folder RLS may block another staffer's file — an orphaned
  // object is acceptable at club scale (same posture as event covers).
  if (row?.storage_path) {
    await supabase.storage.from("documents").remove([row.storage_path]);
  }
  revalidateDocuments();
}
