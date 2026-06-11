import type { Metadata } from "next";
import { ContactStatusBadge } from "@/components/badges";
import { ContactForm } from "@/components/contact-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contact" };

/**
 * Member-facing "contact the club" form plus the member's own message history.
 * Submissions land in the staff inbox (/manage/messages) and notify staff
 * in-app. The member can see what they've sent and whether it's been resolved
 * (RLS lets them read their own rows). We also surface the club's phone and
 * email from club_info as a direct alternative for anyone who'd rather call.
 */
export default async function ContactPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: club }, { data: messages }] = await Promise.all([
    supabase.from("club_info").select("phone, email").maybeSingle(),
    supabase
      .from("contact_messages")
      .select("*")
      .eq("member_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const myMessages = messages ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Contact the club"
        description="Send a note to the front office — we'll get back to you."
      />

      <ContactForm />

      {(club?.phone || club?.email) && (
        <p className="text-sm text-muted">
          Prefer to reach us directly?{" "}
          {club?.phone && (
            <a
              href={`tel:${club.phone.replace(/[^\d+]/g, "")}`}
              className="text-primary hover:underline"
            >
              {club.phone}
            </a>
          )}
          {club?.phone && club?.email && " · "}
          {club?.email && (
            <a
              href={`mailto:${club.email}`}
              className="text-primary hover:underline"
            >
              {club.email}
            </a>
          )}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-h2 text-foreground">Your messages</h2>
        {myMessages.length === 0 ? (
          <EmptyState
            icon={<MessageIcon />}
            title="No messages yet"
            description="Anything you send the front office will show up here."
          />
        ) : (
          <div className="card divide-y divide-border">
            {myMessages.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{m.subject}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                    {m.message}
                  </p>
                  {m.is_resolved && m.resolved_at && (
                    <p className="mt-1 text-sm text-success">
                      Resolved {formatRelativeTime(m.resolved_at)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <ContactStatusBadge resolved={m.is_resolved} />
                  <time
                    dateTime={m.created_at}
                    title={formatTimestamp(m.created_at)}
                    className="text-caption text-muted"
                  >
                    {formatRelativeTime(m.created_at)}
                  </time>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MessageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    </svg>
  );
}
