import { DepartmentBadge } from "@/components/badges";
import { PostActions } from "@/components/post-actions";
import { formatTimestamp } from "@/lib/format";
import type { Post } from "@/lib/database.types";

export function PostCard({
  post,
  authorName,
  canManage,
}: {
  post: Post;
  authorName: string;
  canManage: boolean;
}) {
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DepartmentBadge department={post.department} />
          {post.is_pinned && (
            <span className="badge bg-accent/15 text-accent-600">Pinned</span>
          )}
        </div>
        {canManage && <PostActions id={post.id} isPinned={post.is_pinned} />}
      </div>

      <h3 className="mt-3 font-serif text-xl font-semibold text-foreground">
        {post.title}
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {post.content}
      </p>

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image_url}
          alt=""
          className="mt-4 max-h-96 w-full rounded-lg border border-border object-cover"
        />
      )}

      {post.pdf_url && (
        <a
          href={post.pdf_url}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline btn-sm mt-4"
        >
          View attachment (PDF)
        </a>
      )}

      <p className="mt-4 text-xs text-muted">
        Posted by {authorName} · {formatTimestamp(post.created_at)}
      </p>
    </article>
  );
}
