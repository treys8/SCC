import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const redirectTo = sp.redirectTo?.startsWith("/") ? sp.redirectTo : "/";

  return (
    <AuthShell title="Member sign in" subtitle="Welcome back to the club.">
      {sp.error && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          That sign-in link was invalid or has expired. Please sign in below.
        </p>
      )}
      <LoginForm redirectTo={redirectTo} />
      <p className="mt-5 text-center text-caption text-muted">
        Accounts are created by club staff. Contact the front office if you need
        access.
      </p>
    </AuthShell>
  );
}
