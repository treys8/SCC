import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { updatePost } from "@/app/(app)/posts/actions";
import { PageHeader } from "@/components/page-header";
import { PostForm } from "@/components/post-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit announcement" };

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
    .select("*")
    .eq("id", id)
    .single();

  if (!post) notFound();
  // Only the author may edit (RLS enforces this too).
  if (post.author_id !== profile.id) redirect("/posts");

  const action = updatePost.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit announcement" />
      <PostForm action={action} post={post} submitLabel="Save changes" />
    </div>
  );
}
