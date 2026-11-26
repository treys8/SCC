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
      className="group grid items-center gap-5 border-y border-t-foreground/70 border-b-border py-6 sm:grid-cols-[11rem_1fr] sm:gap-8"
    >
      {photoUrl ? (
        // Log photos live in the public posts bucket, outside next/image's
        // allowlist — plain img, as elsewhere.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="aspect-[4/3] w-full rounded-md object-cover sm:w-44"
        />
      ) : (
        <div
          className="hidden aspect-[4/3] w-44 items-center justify-center rounded-md bg-green-deep text-gold-soft sm:flex"
          aria-hidden
        >
          <FlagGlyph />
        </div>
      )}
      <div className="min-w-0">
        <p className="eyebrow">
          From the course · {formatRelativeTime(createdAt)}
        </p>
        <h3 className="mt-3 font-serif text-2xl leading-tight text-foreground transition-colors group-hover:text-primary sm:text-[1.75rem]">
          {title ?? "Today on the course"}
        </h3>
        <p className="mt-2 line-clamp-2 max-w-[60ch] text-[0.95rem] leading-relaxed text-muted">
          {content}
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
