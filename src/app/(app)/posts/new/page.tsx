import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PostComposer } from "@/components/post-composer";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  const profile = await requireRole("staff", "admin");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New post" />
      <PostComposer userId={profile.id} />
    </div>
  );
}
