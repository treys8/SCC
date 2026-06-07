"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/database.types";

export type InviteState = { error?: string; success?: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function inviteMember(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  await requireRole("admin");

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = (String(formData.get("role") ?? "member") || "member") as UserRole;

  if (!email || !fullName) {
    return { error: "Name and email are both required." };
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${SITE_URL}/auth/callback?next=/set-password`,
  });

  if (error) {
    return { error: error.message };
  }

  // handle_new_user created the profile as 'member'. Elevate if requested.
  if (data.user && role !== "member") {
    const { error: roleErr } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (roleErr) {
      return {
        error: `Invitation sent, but the role could not be set: ${roleErr.message}`,
      };
    }
  }

  revalidatePath("/members");
  return { success: `Invitation sent to ${email}.` };
}

export async function setMemberRole(userId: string, role: UserRole) {
  const me = await requireRole("admin");
  if (me.id === userId) {
    throw new Error("Change your own role from another admin account.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/members");
}

export async function removeMember(userId: string) {
  const me = await requireRole("admin");
  if (me.id === userId) {
    throw new Error("You cannot remove your own account.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  revalidatePath("/members");
}
