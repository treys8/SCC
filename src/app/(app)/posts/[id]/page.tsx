import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { isStaff, requireProfile } from "@/lib/auth";
import { fetchPost } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Post" };

/**
 * A single post on its own page — where a post notification's deep link lands,
 * and the target of the "From the course" card. Renders the same PostCard the
 * feed uses, so a linked post looks exactly like it does in context.
 *
 * RLS hides drafts and scheduled posts from members, so a member following a
 * link to one gets the not-found page rather than a preview of unpublished news.
 */
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const post = await fetchPost(supabase, id);
  if (!post) notFound();

  return (
    <div className="space-y-4">
      <Link href="/posts" className="btn btn-ghost btn-sm">
        ← Back to the feed
      </Link>
      <PostCard
        post={post}
        currentUserId={profile.id}
        canManageAny={isStaff(profile.role)}
      />
    </div>
  );
}
