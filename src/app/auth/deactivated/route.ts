import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing for a session whose login has been deactivated. requireProfile()
 * sends them here because a Server Component can't clear auth cookies; a Route
 * Handler can. The auth ban already stops sign-in and token refresh — this just
 * ends a session that was live when the ban landed.
 *
 * Only signs out a deactivated profile, so a crafted link can't log anyone
 * else out; everyone else is bounced home.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  url.search = "";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("deactivated_at")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.deactivated_at) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    // signOut() clears the session cookies through the server client's
    // cookie adapter (the same path /auth/callback uses to set them). If it
    // errors before clearing, drop the Supabase auth cookies directly —
    // a surviving session would bounce /login → / → here in a loop.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      const store = await cookies();
      for (const c of store.getAll()) {
        if (c.name.startsWith("sb-")) store.delete(c.name);
      }
    }
  }

  url.pathname = "/login";
  url.searchParams.set("error", "deactivated");
  return NextResponse.redirect(url);
}
