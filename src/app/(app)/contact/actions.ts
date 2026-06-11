"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ContactState = { error?: string; success?: boolean };

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 2000;

/**
 * A signed-in member sends a note to the front office. The row is saved under
 * the member's own RLS-gated client (insert-own policy); staff are then alerted
 * in-app + via Web Push using the service-role client, mirroring the
 * reservations notification flow.
 */
export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const profile = await requireProfile();

  const subject = String(formData.get("subject") ?? "")
    .trim()
    .slice(0, SUBJECT_MAX);
  const message = String(formData.get("message") ?? "")
    .trim()
    .slice(0, MESSAGE_MAX);

  if (!subject) return { error: "Add a subject so staff know what it's about." };
  if (!message) return { error: "Write a message before sending." };

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({
    member_id: profile.id,
    subject,
    message,
  });
  if (error) return { error: error.message };

  // Best-effort: a notification failure (or a missing service-role key) must
  // never surface as a failed send — the member's message is already saved.
  try {
    await notifyStaffOfMessage(profile.full_name, subject);
  } catch (e) {
    console.error("contact message notification failed:", e);
  }

  // Refresh the "Your messages" list on /contact so the just-sent message shows.
  revalidatePath("/contact");
  return { success: true };
}

/** Fan out an in-app + push notification to every staff/admin member. */
async function notifyStaffOfMessage(fromName: string, subject: string) {
  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["staff", "admin"]);
  const staffIds = (staff ?? []).map((s) => s.id);
  if (staffIds.length === 0) return;

  const title = "New member message";
  const body = `${fromName}: ${subject}`;
  await admin.from("notifications").insert(
    staffIds.map((id) => ({
      user_id: id,
      type: "contact",
      title,
      body,
      link: "/manage/messages",
    })),
  );

  await sendPushToUsers(staffIds, {
    title,
    body,
    url: "/manage/messages",
    tag: "contact-message",
  });
}
