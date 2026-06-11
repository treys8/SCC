import type { Metadata } from "next";
import { ClubInfoEditor } from "@/components/club-info-editor";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Club info" };

/** Staff editor for the club_info singleton. Gated by the /manage layout. */
export default async function ManageClubInfoPage() {
  const supabase = await createClient();
  const { data: club } = await supabase
    .from("club_info")
    .select("*")
    .maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Club info"
        description="Address, phone, and mailing details shown on the Directory page and the member Contact page."
      />
      {club ? (
        <ClubInfoEditor initial={club} />
      ) : (
        <EmptyState
          title="No club info row"
          description="The club info row hasn't been set up yet."
        />
      )}
    </div>
  );
}
