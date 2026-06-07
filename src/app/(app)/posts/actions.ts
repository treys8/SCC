"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentType } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type PostFormState = { error?: string };

const BUCKET = "posts";

async function uploadToBucket(
  supabase: SupabaseClient<Database>,
  userId: string,
  file: File | null,
  fallbackExt: string,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : fallbackExt;
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function parseFields(formData: FormData) {
  return {
    department: (String(formData.get("department") ?? "general") ||
      "general") as DepartmentType,
    title: String(formData.get("title") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
    isPinned: formData.get("is_pinned") === "on",
  };
}

export async function createPost(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const profile = await requireRole("staff", "admin");
  const { department, title, content, isPinned } = parseFields(formData);
  if (!title || !content) {
    return { error: "Title and content are required." };
  }

  const supabase = await createClient();

  let imageUrl: string | null = null;
  let pdfUrl: string | null = null;
  try {
    imageUrl = await uploadToBucket(
      supabase,
      profile.id,
      formData.get("image") as File | null,
      "png",
    );
    pdfUrl = await uploadToBucket(
      supabase,
      profile.id,
      formData.get("pdf") as File | null,
      "pdf",
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "File upload failed." };
  }

  const { error } = await supabase.from("posts").insert({
    author_id: profile.id,
    department,
    title,
    content,
    image_url: imageUrl,
    pdf_url: pdfUrl,
    is_pinned: isPinned,
  });
  if (error) return { error: error.message };

  revalidatePath("/posts");
  revalidatePath("/");
  redirect("/posts");
}

export async function updatePost(
  id: string,
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const profile = await requireRole("staff", "admin");
  const { department, title, content, isPinned } = parseFields(formData);
  if (!title || !content) {
    return { error: "Title and content are required." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Announcement not found." };

  let imageUrl = existing.image_url;
  let pdfUrl = existing.pdf_url;

  try {
    if (formData.get("remove_image") === "on") imageUrl = null;
    const newImage = await uploadToBucket(
      supabase,
      profile.id,
      formData.get("image") as File | null,
      "png",
    );
    if (newImage) imageUrl = newImage;

    if (formData.get("remove_pdf") === "on") pdfUrl = null;
    const newPdf = await uploadToBucket(
      supabase,
      profile.id,
      formData.get("pdf") as File | null,
      "pdf",
    );
    if (newPdf) pdfUrl = newPdf;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "File upload failed." };
  }

  const { error } = await supabase
    .from("posts")
    .update({
      department,
      title,
      content,
      image_url: imageUrl,
      pdf_url: pdfUrl,
      is_pinned: isPinned,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/posts");
  revalidatePath("/");
  redirect("/posts");
}

export async function deletePost(id: string) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/posts");
  revalidatePath("/");
}

export async function togglePin(id: string, isPinned: boolean) {
  await requireRole("staff", "admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: isPinned })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/posts");
  revalidatePath("/");
}
