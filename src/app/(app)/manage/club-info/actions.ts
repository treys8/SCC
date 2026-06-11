"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ClubInfoState = { error?: string; success?: string };

/**
 * Staff/admin edit the single club_info row (address, phone, mailing details)
 * shown on the member Directory page. Singleton table seeded by migration, so
 * there's no insert path — a 0-row update means the row is gone. Mirrors the
 * useActionState form pattern (invite-member / event-form).
 */
export async function saveClubInfo(
  _prev: ClubInfoState,
  formData: FormData,
): Promise<ClubInfoState> {
  const profile = await requireRole("staff", "admin");

  const get = (key: string, max: number): string | null =>
    String(formData.get(key) ?? "")
      .trim()
      .slice(0, max) || null;

  const clean = {
    street_address: get("street_address", 120),
    city: get("city", 80),
    state: get("state", 40),
    postal_code: get("postal_code", 20),
    mailing_address: get("mailing_address", 160),
    phone: get("phone", 40),
    email: get("email", 120),
    website: get("website", 200),
    updated_by: profile.id,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_info")
    .update(clean)
    .eq("id", true)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Club info row is missing." };

  revalidatePath("/manage/club-info");
  revalidatePath("/directory");
  return { success: "Saved." };
}
