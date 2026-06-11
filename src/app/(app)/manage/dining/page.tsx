import type { Metadata } from "next";
import { BuffetEditor } from "@/components/buffet-editor";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dining" };

/**
 * Dining console: today's lunch buffet card members see on the Today home.
 * (Restaurant hours / structured menus may join this page later; menus ship as
 * uploaded PDFs via the Documents console for now.) Gated by the /manage layout.
 */
export default async function ManageDiningPage() {
  const supabase = await createClient();
  const { data: buffet } = await supabase
    .from("dining_buffet")
    .select("*")
    .maybeSingle();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dining"
        description="The lunch buffet card members see on the Today home page."
      />
      {buffet ? (
        <BuffetEditor initial={buffet} />
      ) : (
        <EmptyState
          title="No buffet configured"
          description="The dining buffet row hasn't been set up yet."
        />
      )}
    </div>
  );
}
