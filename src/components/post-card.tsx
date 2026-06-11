import { AttachmentList } from "@/components/attachment-list";
import { DepartmentBadge } from "@/components/badges";
import { Crest } from "@/components/crest";
import { PostActions } from "@/components/post-actions";
import { PostGallery } from "@/components/post-gallery";
import { cn } from "@/lib/cn";
import { CLUB_NAME } from "@/lib/constants";
import { sortedAttachments } from "@/lib/feed";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import type { FeedPost } from "@/lib/database.types";

export function PostCard({
  post,
  currentUserId,
}: {
  post: FeedPost;
  currentUserId: string;
}) {
  const canManage = post.author_id === currentUserId;
  // A club-voice post is the club speaking, not the staffer who published it:
  // show the club's name + crest. A member post shows that member's own byline.
  const isClub = post.author_type === "club";
  const authorName = isClub ? CLUB_NAME : post.author?.full_name ?? "Member";
  const avatarUrl = post.author?.avatar_url ?? null;

  const attachments = sortedAttachments(post);
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");

  return (
    <article
      className={cn(
        "card overflow-hidden p-4 sm:p-5",
        // Pinned posts get a subtle gold left edge + warm tint to stand apart.
        post.is_pinned && "border-l-2 border-l-accent bg-accent/[0.05]",
      )}
    >
      <div className="flex items-start gap-3">
        {isClub ? (
          <Crest className="h-10 w-10 shrink-0" />
        ) : (
          <Avatar name={authorName} url={avatarUrl} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-foreground">
              {authorName}
            </span>
            <span aria-hidden className="text-muted">
              ·
            </span>
            <time
              dateTime={post.created_at}
              title={formatTimestamp(post.created_at)}
              suppressHydrationWarning
              className="shrink-0 text-caption text-muted"
            >
              {formatRelativeTime(post.created_at)}
            </time>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <DepartmentBadge department={post.department} />
            {post.is_pinned && (
              <span className="badge items-center gap-1 bg-accent/10 text-accent-600">
                <span aria-hidden>📌</span>
                Pinned
              </span>
            )}
          </div>
        </div>

        {canManage && (
          <div className="-mr-1 -mt-1 shrink-0">
            <PostActions id={post.id} isPinned={post.is_pinned} />
          </div>
        )}
      </div>

      {post.title && (
        <h3 className="mt-3 text-h2 tracking-tight text-foreground">
          {post.title}
        </h3>
      )}
      {post.content && (
        <p className="mt-2.5 whitespace-pre-wrap break-words text-body text-foreground/90">
          {post.content}
        </p>
      )}

      {images.length > 0 && <PostGallery images={images} />}
      {files.length > 0 && <AttachmentList files={files} />}
    </article>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      // Avatar hosts vary and aren't in next/image's allowlist — plain img.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white"
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
