import { AttachmentList } from "@/components/attachment-list";
import { DepartmentBadge, DEPARTMENT_ACCENT } from "@/components/badges";
import { PostActions } from "@/components/post-actions";
import { PostGallery } from "@/components/post-gallery";
import { cn } from "@/lib/cn";
import { DEPARTMENT_LABEL } from "@/lib/constants";
import { sortedAttachments } from "@/lib/feed";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import type { FeedPost } from "@/lib/database.types";

/**
 * A feed post. Club-voice posts are category-led: a department-coloured left
 * accent bar (gold when pinned) and an uppercase department header, no crest or
 * club byline. Member posts keep their avatar + name byline. Post actions show
 * for the author (edit/delete) and for staff (pin any post); `canManageAny` is
 * the viewer's staff flag.
 */
export function PostCard({
  post,
  currentUserId,
  canManageAny,
}: {
  post: FeedPost;
  currentUserId: string;
  canManageAny: boolean;
}) {
  const isAuthor = post.author_id === currentUserId;
  const showMenu = isAuthor || canManageAny;
  const isClub = post.author_type === "club";

  const attachments = sortedAttachments(post);
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");

  const actions = showMenu ? (
    <PostActions
      id={post.id}
      isPinned={post.is_pinned}
      isAuthor={isAuthor}
      canPin={canManageAny}
    />
  ) : null;

  const body = (
    <>
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
    </>
  );

  if (isClub) {
    const accent = DEPARTMENT_ACCENT[post.department];
    // Pinned club posts take a gold bar; otherwise the department's own hue.
    const barColor = post.is_pinned ? "bg-accent" : accent.bar;
    return (
      <article
        className={cn(
          "card relative overflow-hidden p-4 pl-5 sm:p-5 sm:pl-6",
          post.is_pinned && "bg-accent/[0.04]",
        )}
      >
        <span
          className={cn("absolute inset-y-0 left-0 w-[3px]", barColor)}
          aria-hidden
        />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", barColor)}
              aria-hidden
            />
            <span
              className={cn(
                "truncate text-caption font-semibold uppercase tracking-wide",
                accent.text,
              )}
            >
              {DEPARTMENT_LABEL[post.department]}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {post.is_pinned && (
              <>
                <span className="sr-only">Pinned</span>
                <span aria-hidden title="Pinned" className="text-accent-600">
                  📌
                </span>
              </>
            )}
            <time
              dateTime={post.created_at}
              title={formatTimestamp(post.created_at)}
              suppressHydrationWarning
              className="text-caption text-muted"
            >
              {formatRelativeTime(post.created_at)}
            </time>
            {actions && <div className="-mr-1 -mt-1">{actions}</div>}
          </div>
        </div>
        {body}
      </article>
    );
  }

  // Member post — that member's own avatar + name byline.
  const authorName = post.author?.full_name ?? "Member";
  const avatarUrl = post.author?.avatar_url ?? null;
  return (
    <article
      className={cn(
        "card overflow-hidden p-4 sm:p-5",
        // Pinned member posts get a subtle gold left edge + warm tint.
        post.is_pinned && "border-l-2 border-l-accent bg-accent/[0.05]",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={authorName} url={avatarUrl} />

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

        {actions && <div className="-mr-1 -mt-1 shrink-0">{actions}</div>}
      </div>

      {body}
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
