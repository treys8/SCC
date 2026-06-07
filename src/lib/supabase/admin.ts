import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Privileged Supabase client using the SERVICE ROLE / secret key.
 * Bypasses Row-Level Security — use ONLY in trusted server code
 * (Server Actions, Route Handlers) for admin operations such as
 * inviting members and assigning roles.
 *
 * The `server-only` import above makes the build fail if this module is
 * ever imported into a Client Component.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
