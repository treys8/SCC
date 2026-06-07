import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SetPasswordForm } from "@/components/set-password-form";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Set your password" };

export default async function SetPasswordPage() {
  const user = await getUser();

  if (!user) {
    return (
      <AuthShell title="Link expired">
        <p className="text-sm text-muted">
          This invitation link is no longer valid. Please ask club staff to
          resend your invitation.
        </p>
        <Link href="/login" className="btn btn-outline mt-4 w-full">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome to the club"
      subtitle="Choose a password to finish setting up your account."
    >
      <SetPasswordForm />
    </AuthShell>
  );
}
