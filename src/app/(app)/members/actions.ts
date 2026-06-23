"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, requireRole } from "@/lib/auth";
import type { UserRole } from "@/lib/database.types";
import {
  ACCOUNT_NUMBER_RE,
  type RosterInput,
  type RowOutcome,
  normalizeRow,
  validateRow,
} from "@/lib/roster";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteState = { error?: string; success?: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Max rows accepted per bulk call. The client chunks well below this; the cap
// just keeps a single Server Action invocation short and bounded.
const BULK_CHUNK_MAX = 100;

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

// Supabase returns this when the email already has an auth user — an expected,
// non-fatal outcome when an import is re-run.
function isAlreadyRegistered(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "email_exists" ||
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("already exists")
  );
}

type InviteOneInput = {
  email: string; // trimmed/lowercased; "" allowed only for members (account-only)
  fullName: string; // trimmed
  accountNumber: string; // members only; "" for staff/admin
  role: UserRole;
  titleId?: string; // staff/admin only
  createdBy: string;
  rowNumber?: number; // for bulk outcome labeling
};

type InviteOneOutcome = RowOutcome & { accountExisted?: boolean };

/**
 * Core single-member invite: ensure the account, send the invite email, and
 * apply the protected profile columns (account number / role / title) with the
 * service-role client. Shared by the one-off invite form and the bulk import so
 * both behave identically.
 */
async function inviteOneMember(
  admin: ReturnType<typeof createAdminClient>,
  input: InviteOneInput,
): Promise<InviteOneOutcome> {
  const { email, fullName, accountNumber, role, titleId, createdBy } = input;
  const base = {
    rowNumber: input.rowNumber ?? 0,
    email,
    fullName,
    accountNumber,
  };

  let accountExisted = false;
  if (role === "member") {
    if (!ACCOUNT_NUMBER_RE.test(accountNumber)) {
      return { ...base, kind: "error", message: "Account number must be 1–5 digits." };
    }
    const account = await ensureAccount(admin, accountNumber, createdBy);
    if ("error" in account) {
      return { ...base, kind: "error", message: `Could not set up the account: ${account.error}` };
    }
    accountExisted = account.existed;
  } else if (titleId) {
    const { data: title } = await admin
      .from("staff_titles")
      .select("id")
      .eq("id", titleId)
      .maybeSingle();
    if (!title) return { ...base, kind: "error", message: "That staff title no longer exists." };
  }

  // No email on file → the account row exists but there's no login to create.
  if (!email) {
    if (role === "member") return { ...base, kind: "account_only", accountExisted };
    return { ...base, kind: "error", message: "Email is required." };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${SITE_URL}/auth/callback?next=/set-password`,
  });

  if (error) {
    if (isAlreadyRegistered(error)) {
      return { ...base, kind: "skipped_existing", message: "Already has a login.", accountExisted };
    }
    return { ...base, kind: "error", message: error.message };
  }

  // handle_new_user created the profile as a bare 'member'. Set role
  // (admin-elevated invites), account number, and title afterwards — account
  // and title are intentionally NOT passed through auth metadata, which a
  // self-signup could spoof to claim someone else's account.
  if (data.user) {
    const updates: { role?: UserRole; account_number?: string; title_id?: string } = {};
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
          ...base,
          kind: "error",
          message: `Invitation sent, but the profile could not be fully set up: ${friendly}`,
        };
      }
    }
  }

  return { ...base, kind: "invited", accountExisted };
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
  const outcome = await inviteOneMember(admin, {
    email,
    fullName,
    accountNumber,
    role,
    titleId: titleId || undefined,
    createdBy: me.id,
  });

  if (outcome.kind === "error") return { error: outcome.message };
  if (outcome.kind === "skipped_existing") {
    return { error: "That email already has a login." };
  }

  revalidatePath("/members");
  if (role === "member") {
    return {
      success: outcome.accountExisted
        ? `Invitation sent to ${email} — added to existing account #${accountNumber}.`
        : `Invitation sent to ${email} — created account #${accountNumber}.`,
    };
  }
  return { success: `Invitation sent to ${email}.` };
}

/**
 * Invite a chunk of members from the roster import. Members only (role is
 * forced). Never aborts on a bad row — every row gets an outcome so the client
 * can show a per-row summary and offer a retry CSV of the failures.
 */
export async function bulkInviteMembers(rows: RosterInput[]): Promise<RowOutcome[]> {
  const me = await requireRole("staff", "admin");
  if (rows.length > BULK_CHUNK_MAX) {
    throw new Error(`Import in chunks of ${BULK_CHUNK_MAX} rows or fewer.`);
  }

  const admin = createAdminClient();
  const outcomes: RowOutcome[] = [];

  for (const raw of rows) {
    const row = normalizeRow(raw);
    const check = validateRow(row);
    if (check.kind === "error") {
      outcomes.push({
        rowNumber: row.rowNumber,
        email: row.email,
        fullName: row.fullName,
        accountNumber: row.accountNumber,
        kind: "error",
        message: check.message,
      });
      continue;
    }

    const outcome = await inviteOneMember(admin, {
      email: row.email,
      fullName: row.fullName,
      accountNumber: row.accountNumber,
      role: "member",
      createdBy: me.id,
      rowNumber: row.rowNumber,
    });
    outcomes.push({
      rowNumber: outcome.rowNumber,
      email: outcome.email,
      fullName: outcome.fullName,
      accountNumber: outcome.accountNumber,
      kind: outcome.kind,
      message: outcome.message,
    });
  }

  revalidatePath("/members");
  return outcomes;
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
