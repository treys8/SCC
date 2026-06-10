import type { Metadata } from "next";
import { DepartmentPreferencesForm } from "@/components/department-preferences-form";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile-form";
import { PushToggle } from "@/components/push-toggle";
import { requireProfile } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { getDepartmentPreferences } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const profile = await requireProfile();

  const supabase = await createClient();
  const departments = await getDepartmentPreferences(supabase, profile.id);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="My Profile"
        description={`Signed in as ${ROLE_LABEL[profile.role]}.`}
      />
      <ProfileForm profile={profile} />
      <DepartmentPreferencesForm selected={departments} />
      <PushToggle />
    </div>
  );
}
