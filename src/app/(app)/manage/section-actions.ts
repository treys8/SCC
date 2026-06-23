"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SectionPage } from "@/lib/database.types";

const HEADING_MAX = 80;
const BODY_MAX = 4000;

const PAGES: SectionPage[] = ["dining", "pool"];

function assertPage(page: string): SectionPage {
  if (!PAGES.includes(page as SectionPage)) {
    throw new Error("Unknown page.");
  }
  return page as SectionPage;
}

// Both the member destination page and its staff editor read these rows.
function revalidate(page: SectionPage) {
  revalidatePath(`/${page}`);
  revalidatePath(`/manage/${page}`);
}

/** Add a blank, unpublished section at the end of a page. */
export async function addSection(page: SectionPage): Promise<void> {
  const profile = await requireRole("staff", "admin");
  const p = assertPage(page);
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("page_sections")
    .select("sort_order")
    .eq("page", p)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("page_sections").insert({
    page: p,
    heading: "New section",
    body: "",
    sort_order: nextOrder,
    is_published: false,
    updated_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidate(p);
}

/** Save one section's heading, body, and published flag. */
export async function saveSection(input: {
  id: string;
  page: SectionPage;
  heading: string;
  body: string;
  is_published: boolean;
}): Promise<void> {
  const profile = await requireRole("staff", "admin");
  const p = assertPage(input.page);
  const supabase = await createClient();

  const heading = input.heading.trim().slice(0, HEADING_MAX) || "Untitled";
  const body = input.body.slice(0, BODY_MAX);

  const { error } = await supabase
    .from("page_sections")
    .update({
      heading,
      body,
      is_published: input.is_published,
      updated_by: profile.id,
    })
    .eq("id", input.id)
    .eq("page", p);
  if (error) throw new Error(error.message);
  revalidate(p);
}

/** Delete one section. */
export async function deleteSection(
  id: string,
  page: SectionPage,
): Promise<void> {
  await requireRole("staff", "admin");
  const p = assertPage(page);
  const supabase = await createClient();

  const { error } = await supabase
    .from("page_sections")
    .delete()
    .eq("id", id)
    .eq("page", p);
  if (error) throw new Error(error.message);
  revalidate(p);
}

/** Swap a section with its neighbor above/below to reorder. */
export async function moveSection(
  id: string,
  page: SectionPage,
  dir: "up" | "down",
): Promise<void> {
  const profile = await requireRole("staff", "admin");
  const p = assertPage(page);
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("page_sections")
    .select("id, sort_order")
    .eq("page", p)
    .order("sort_order", { ascending: true });
  if (!rows) return;

  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return; // already at an end

  const a = rows[i];
  const b = rows[j];
  // Swap the two sort_order values.
  const updates = [
    supabase
      .from("page_sections")
      .update({ sort_order: b.sort_order, updated_by: profile.id })
      .eq("id", a.id),
    supabase
      .from("page_sections")
      .update({ sort_order: a.sort_order, updated_by: profile.id })
      .eq("id", b.id),
  ];
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidate(p);
}
