import type { Metadata } from "next";
import { DepartmentPreferencesForm } from "@/components/department-preferences-form";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile-form";
import { PushToggle } from "@/components/push-toggle";
import { requireProfile } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { getDepartmentOptIns } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const profile = await requireProfile();

  const supabase = await createClient();
  const departments = await getDepartmentOptIns(supabase, profile.id);

  let description = `Signed in as ${ROLE_LABEL[profile.role]}.`;
  if (profile.account_number) {
    description = `Account #${profile.account_number} — signed in as ${ROLE_LABEL[profile.role]}.`;
  } else if (profile.title_id) {
    const { data: title } = await supabase
      .from("staff_titles")
      .select("name")
      .eq("id", profile.title_id)
      .maybeSingle();
    if (title) {
      description = `Signed in as ${ROLE_LABEL[profile.role]} — ${title.name}.`;
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="My Profile" description={description} />
      <ProfileForm profile={profile} />
      <DepartmentPreferencesForm selected={departments} />
      <PushToggle />
    </div>
  );
}
