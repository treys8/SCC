import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PostComposer } from "@/components/post-composer";
import { isStaff, requireRole } from "@/lib/auth";
import { clubTodayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { PostAttachment } from "@/lib/database.types";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRole("staff", "admin");

  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("*, post_attachments(*)")
    .eq("id", id)
    .single();

  if (!post) notFound();
  // Staff/admin may edit any post (the staff console links here); the author
  // check is the fallback should that role gate ever be loosened. updatePost
  // re-checks server-side.
  if (!isStaff(profile.role) && post.author_id !== profile.id) redirect("/posts");

  const attachments = [...((post.post_attachments as PostAttachment[]) ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  // Upcoming events for the link selector, plus the currently-linked one even
  // if it's now in the past (so editing doesn't silently drop it).
  const today = clubTodayISO();
  const eventsQuery = supabase
    .from("calendar_events")
    .select("id, title, event_date");
  const { data: events } = await (post.event_id
    ? eventsQuery.or(`event_date.gte.${today},id.eq.${post.event_id}`)
    : eventsQuery.gte("event_date", today)
  ).order("event_date", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit post" />
      <PostComposer
        userId={profile.id}
        events={events ?? []}
        post={{
          id: post.id,
          department: post.department,
          author_type: post.author_type,
          title: post.title,
          content: post.content,
          is_pinned: post.is_pinned,
          event_id: post.event_id,
          reservation_cta: post.reservation_cta,
          attachments,
        }}
      />
    </div>
  );
}
