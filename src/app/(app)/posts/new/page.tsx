import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PostComposer, type InitialPost } from "@/components/post-composer";
import { requireRole } from "@/lib/auth";
import { clubTodayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const profile = await requireRole("staff", "admin");

  // Upcoming events a post can link to (renders their Register button inline).
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, title, event_date")
    .gte("event_date", clubTodayISO())
    .order("event_date", { ascending: true });

  // "Use as template": seed the composer from an existing post's text/category/
  // voice (not its attachments). Missing/unreadable source → just start blank.
  const { from } = await searchParams;
  let initial: InitialPost | undefined;
  if (from) {
    const { data: source } = await supabase
      .from("posts")
      .select("department, author_type, title, content")
      .eq("id", from)
      .single();
    if (source) {
      initial = {
        department: source.department,
        // Keep a headline-less post (e.g. a menu) clean; only mark real titles.
        title: source.title ? `${source.title} (copy)` : "",
        content: source.content ?? "",
        asClub: source.author_type === "club",
      };
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New post" />
      <PostComposer
        userId={profile.id}
        events={events ?? []}
        initial={initial}
      />
    </div>
  );
}
