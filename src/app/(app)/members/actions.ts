"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/database.types";

export type InviteState = { error?: string; success?: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Staff-assigned club account number: 1–5 digits, leading zeros significant
// ('00123' ≠ '123'), so it is validated and stored as text, never parsed.
const ACCOUNT_NUMBER_RE = /^[0-9]{1,5}$/;

/**
 * Ensure the account row exists, creating it if needed.
 * Returns whether it already existed (drives the success message, so a typo'd
 * number that silently creates a fresh account is visible to the inviter).
 */
async function ensureAccount(
  admin: ReturnType<typeof createAdminClient>,
  accountNumber: string,
  createdBy: string,
): Promise<{ existed: boolean } | { error: string }> {
  const { data: existing, error: lookupErr } = await admin
    .from("accounts")
    .select("account_number")
    .eq("account_number", accountNumber)
    .maybeSingle();
  if (lookupErr) return { error: lookupErr.message };
  if (existing) return { existed: true };

  const { error: insertErr } = await admin
    .from("accounts")
    .insert({ account_number: accountNumber, created_by: createdBy });
  if (insertErr) return { error: insertErr.message };
  return { existed: false };
}

export async function inviteMember(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const me = await requireRole("staff", "admin");
  const callerIsAdmin = isAdmin(me.role);

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  // Staff can only invite members — ignore whatever role the form claims.
  const role = callerIsAdmin
    ? ((String(formData.get("role") ?? "member") || "member") as UserRole)
    : "member";
  const accountNumber = String(formData.get("account_number") ?? "").trim();
  const titleId = String(formData.get("title_id") ?? "").trim();

  if (!email || !fullName) {
    return { error: "Name and email are both required." };
  }

  const admin = createAdminClient();

  let accountExisted = false;
  if (role === "member") {
    if (!ACCOUNT_NUMBER_RE.test(accountNumber)) {
      return { error: "Account number must be 1–5 digits." };
    }
    const account = await ensureAccount(admin, accountNumber, me.id);
    if ("error" in account) {
      return { error: `Could not set up the account: ${account.error}` };
    }
    accountExisted = account.existed;
  } else if (titleId) {
    const { data: title } = await admin
      .from("staff_titles")
      .select("id")
      .eq("id", titleId)
      .maybeSingle();
    if (!title) return { error: "That staff title no longer exists." };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${SITE_URL}/auth/callback?next=/set-password`,
  });

  if (error) {
    return { error: error.message };
  }

  // handle_new_user created the profile as a bare 'member'. Set role
  // (admin-elevated invites), account number, and title afterwards — account
  // and title are intentionally NOT passed through auth metadata, which a
  // self-signup could spoof to claim someone else's account.
  if (data.user) {
    const updates: {
      role?: UserRole;
      account_number?: string;
      title_id?: string;
    } = {};
    if (role !== "member") updates.role = role;
    if (role === "member") updates.account_number = accountNumber;
    if (role !== "member" && titleId) updates.title_id = titleId;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await admin
        .from("profiles")
        .update(updates)
        .eq("id", data.user.id);
      if (updateErr) {
        const friendly = updateErr.message.includes("limited to")
          ? "that title is already filled"
          : updateErr.message;
        return {
          error: `Invitation sent, but the profile could not be fully set up: ${friendly}`,
        };
      }
    }
  }

  revalidatePath("/members");
  if (role === "member") {
    return {
      success: accountExisted
        ? `Invitation sent to ${email} — added to existing account #${accountNumber}.`
        : `Invitation sent to ${email} — created account #${accountNumber}.`,
    };
  }
  return { success: `Invitation sent to ${email}.` };
}

export async function setMemberAccount(
  userId: string,
  accountNumber: string | null,
) {
  const me = await requireRole("staff", "admin");

  const admin = createAdminClient();

  if (accountNumber !== null) {
    const trimmed = accountNumber.trim();
    if (!ACCOUNT_NUMBER_RE.test(trimmed)) {
      throw new Error("Account number must be 1–5 digits.");
    }
    const account = await ensureAccount(admin, trimmed, me.id);
    if ("error" in account) throw new Error(account.error);
    accountNumber = trimmed;
  }

  const { error } = await admin
    .from("profiles")
    .update({ account_number: accountNumber })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/members");
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
