import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PostComposer } from "@/components/post-composer";
import { requireRole } from "@/lib/auth";
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
  // Only the author may edit (RLS enforces this too).
  if (post.author_id !== profile.id) redirect("/posts");

  const attachments = [...((post.post_attachments as PostAttachment[]) ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit post" />
      <PostComposer
        userId={profile.id}
        post={{
          id: post.id,
          department: post.department,
          author_type: post.author_type,
          title: post.title,
          content: post.content,
          is_pinned: post.is_pinned,
          attachments,
        }}
      />
    </div>
  );
}
