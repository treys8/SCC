import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile-form";
import { requireProfile } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const profile = await requireProfile();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="My Profile"
        description={`Signed in as ${ROLE_LABEL[profile.role]}.`}
      />
      <ProfileForm profile={profile} />
    </div>
  );
}
