"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import {
  fetchNotificationsPage,
  type NotificationsPage,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

/** Mark all of the signed-in member's unread notifications as read. */
export async function markAllNotificationsRead() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", profile.id)
    .eq("is_read", false);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}

/** Mark a single notification read (scoped to the owner; RLS enforces it too). */
export async function markNotificationRead(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", profile.id);
  if (error) throw new Error(error.message);
  // "layout" so the nav bell badge (unread count lives in (app)/layout, not the
  // page) refreshes too — not just the /notifications page.
  revalidatePath("/", "layout");
}

/** Next keyset page of the member's notifications, older than `before`. */
export async function loadMoreNotifications(
  before: string,
): Promise<NotificationsPage> {
  const profile = await requireProfile();
  const supabase = await createClient();
  return fetchNotificationsPage(supabase, profile.id, before);
}
