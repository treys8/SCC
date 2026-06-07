import type { Metadata } from "next";
import { createPost } from "@/app/(app)/posts/actions";
import { PageHeader } from "@/components/page-header";
import { PostForm } from "@/components/post-form";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "New announcement" };

export default async function NewPostPage() {
  await requireRole("staff", "admin");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New announcement" />
      <PostForm action={createPost} submitLabel="Publish" />
    </div>
  );
}
