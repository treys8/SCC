import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";

/**
 * "From the course" — the superintendent's latest update, shared to members from
 * the daily log. The thing members most want from the golf side is what the
 * course is actually like today, and he already writes it down every morning.
 *
 * Photo-led when there's one (the log is usually shot on a phone out on the
 * course), text-only otherwise. The page only renders this when there's a recent
 * update, so it assumes there's something to show.
 */
export function CourseUpdateCard({
  postId,
  title,
  content,
  photoUrl,
  createdAt,
}: {
  postId: string;
  title: string | null;
  content: string;
  photoUrl: string | null;
  createdAt: string;
}) {
  return (
    <Link
      href={`/posts/${postId}`}
      className="group card flex gap-4 overflow-hidden p-3 transition-colors hover:border-primary sm:p-4"
    >
      {photoUrl ? (
        // Log photos live in the public posts bucket, outside next/image's
        // allowlist — plain img, as elsewhere.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="h-20 w-20 shrink-0 rounded-lg object-cover sm:h-24 sm:w-24"
        />
      ) : (
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-primary text-white sm:h-24 sm:w-24"
          aria-hidden
        >
          <FlagGlyph />
        </div>
      )}
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-caption font-semibold uppercase tracking-wide text-accent-600">
          From the course
        </p>
        <h3 className="mt-1 text-h2 text-foreground">
          {title ?? "Today on the course"}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{content}</p>
        <p className="mt-1 text-caption text-muted">
          {formatRelativeTime(createdAt)}
        </p>
      </div>
    </Link>
  );
}

/** A pin-flag glyph for the text-only fallback (matching the house SVG style). */
function FlagGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 21V3l11 4-11 4" />
    </svg>
  );
}
