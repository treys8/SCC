import type { Profile } from "@/lib/database.types";

/** The name fields a greeting needs from a member's profile. */
type NameFields = Pick<Profile, "display_name" | "full_name" | "email">;

/**
 * A usable human name, or null. Blank values and the login email don't count:
 * `handle_new_user` seeds `full_name` with the email when no name is supplied,
 * so an email-shaped value means "no name on file" — not something to greet by.
 */
function cleanName(
  value: string | null | undefined,
  email: string,
): string | null {
  const name = (value ?? "").trim();
  if (!name) return null;
  if (name.includes("@")) return null;
  if (name.toLowerCase() === email.trim().toLowerCase()) return null;
  return name;
}

/**
 * The member's first name for greetings ("Good morning, Trey"), preferring the
 * chosen `display_name` over the formal `full_name`. Returns null when no real
 * name is on file, so callers can fall back to a generic greeting.
 */
export function memberFirstName(p: NameFields): string | null {
  const name =
    cleanName(p.display_name, p.email) ?? cleanName(p.full_name, p.email);
  return name ? name.split(/\s+/)[0] : null;
}
