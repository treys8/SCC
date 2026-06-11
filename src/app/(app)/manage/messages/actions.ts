"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Staff toggle a member contact message between open and resolved. Resolving
 * stamps who/when; reopening clears both. Gated to staff/admin by RLS and the
 * role check here.
 */
export async function setMessageResolved(id: string, resolved: boolean) {
  const profile = await requireRole("staff", "admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("contact_messages")
    .update({
      is_resolved: resolved,
      resolved_by: resolved ? profile.id : null,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/manage/messages");
}
