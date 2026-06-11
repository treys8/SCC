import type { Metadata } from "next";
import { ContactInbox } from "@/components/contact-inbox";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import type { ContactMessageWithMember } from "@/lib/database.types";

export const metadata: Metadata = { title: "Messages" };

/**
 * Staff inbox for member contact-form submissions. Open messages sort first,
 * newest within each group. Gated by the /manage layout (staff/admin only).
 */
export default async function ManageMessagesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_messages")
    .select(
      "*, member:profiles!contact_messages_member_id_fkey(full_name, email)",
    )
    .order("is_resolved", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ContactMessageWithMember[]>();

  const messages = data ?? [];
  const openCount = messages.filter((m) => !m.is_resolved).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description={
          openCount > 0
            ? `${openCount} open ${
                openCount === 1 ? "message" : "messages"
              } from members.`
            : "Member questions and requests sent from the Contact page."
        }
      />
      {messages.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Member messages from the Contact page will appear here."
        />
      ) : (
        <ContactInbox messages={messages} />
      )}
    </div>
  );
}
