import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PostComposer } from "@/components/post-composer";
import { requireRole } from "@/lib/auth";
import { clubTodayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  const profile = await requireRole("staff", "admin");

  // Upcoming events a post can link to (renders their Register button inline).
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, title, event_date")
    .gte("event_date", clubTodayISO())
    .order("event_date", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New post" />
      <PostComposer userId={profile.id} events={events ?? []} />
    </div>
  );
}
