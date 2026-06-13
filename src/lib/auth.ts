import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/database.types";

/** The authenticated auth user (or null). Memoized per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The signed-in member's profile row (or null). Memoized per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
});

/** Require a profile; redirect to /login if missing. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Require one of the given roles; redirect home if not allowed. */
export async function requireRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}

/**
 * The signed-in staff member's title name (e.g. "Director of Golf"), or null for
 * members and titleless staff. Memoized per request. Resolves `profiles.title_id`
 * against the `staff_titles` lookup — the same join the Members/Profile pages use.
 */
export const getTitleName = cache(async (): Promise<string | null> => {
  const profile = await getProfile();
  if (!profile?.title_id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_titles")
    .select("name")
    .eq("id", profile.title_id)
    .single();
  return data?.name ?? null;
});

/**
 * Require the signed-in user to hold one of the given staff titles; redirect home
 * otherwise. Admins always pass (the catch-all operator). Use to gate
 * title-specific surfaces like the golf-course log. This is a navigation guard —
 * the security boundary is RLS on the underlying tables.
 */
export async function requireTitle(...names: string[]): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role === "admin") return profile;
  const title = await getTitleName();
  if (!title || !names.includes(title)) redirect("/");
  return profile;
}

export function isStaff(role: UserRole): boolean {
  return role === "staff" || role === "admin";
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}
