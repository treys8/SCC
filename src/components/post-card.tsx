import Link from "next/link";
import { AttachmentList } from "@/components/attachment-list";
import { DepartmentBadge, DEPARTMENT_ACCENT } from "@/components/badges";
import { DateChip } from "@/components/calendar/date-chip";
import { RegisterLink } from "@/components/event-card";
import { PostActions } from "@/components/post-actions";
import { PostGallery } from "@/components/post-gallery";
import { cn } from "@/lib/cn";
import { DEPARTMENT_LABEL } from "@/lib/constants";
import { sortedAttachments } from "@/lib/feed";
import {
  clubTodayISO,
  formatDate,
  formatRelativeTime,
  formatTimeRange,
  formatTimestamp,
} from "@/lib/format";
import type { CalendarEvent, FeedPost } from "@/lib/database.types";

/**
 * A feed post. Club-voice posts are category-led: a department-coloured left
 * accent bar (gold when pinned) and an uppercase department header, with a
 * "Posted by Name · Title" attribution line when the staff author resolves.
 * Member posts keep their avatar + name byline (title appended for staff).
 * A linked calendar event renders an inline card with its Register button.
 * Post actions show for the author (edit/delete) and for staff (pin any post);
 * `canManageAny` is the viewer's staff flag.
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
  // A "reservations required" callout is only actionable while the date is still
  // upcoming. Once it's passed, fall back to the soft CTA (or nothing) so an old
  // announcement doesn't keep showing a dead Reserve button for a bygone date.
  const requiredDate = post.reservation_required_date;
  const requiredUpcoming = requiredDate ? requiredDate >= clubTodayISO() : false;

  const attachments = sortedAttachments(post);
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");

  // Official posts attribute the staff author: "Posted by Name · Title". Null
  // for posts whose author has no resolvable display name.
  const byline = post.author?.full_name
    ? `Posted by ${post.author.full_name}${
        post.author.title ? ` · ${post.author.title}` : ""
      }`
    : null;

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
      {post.event && <PostEventCard event={post.event} />}
      {requiredUpcoming && requiredDate ? (
        <PostReservationRequired date={requiredDate} />
      ) : (
        post.reservation_cta && <PostReservationCta />
      )}
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
        {byline && (
          <p className="mt-1 text-caption text-muted">{byline}</p>
        )}
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
            {post.author?.title && (
              <span className="shrink-0 text-caption text-muted">
                · {post.author.title}
              </span>
            )}
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

/**
 * A linked event embedded in a post: compact date/when card plus the event's
 * Register button (deep-links out to GolfGenius etc.). Mirrors EventCard's
 * structure — body links to the event detail, footer action stays separately
 * tappable — so a feed announcement carries the same CTA as the calendar.
 */
function PostEventCard({ event }: { event: CalendarEvent }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border">
      <Link
        href={`/calendar/${event.id}`}
        className="flex gap-3 p-3 transition-colors hover:bg-surface-2"
      >
        <DateChip dateStr={event.event_date} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-foreground">
            {event.title}
          </h4>
          <p className="mt-0.5 text-sm text-muted">
            {formatDate(event.event_date)} ·{" "}
            {formatTimeRange(event.start_time, event.end_time)}
          </p>
          {(event.location || event.fee) && (
            <p className="mt-0.5 text-sm text-muted">
              {[event.location, event.fee].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </Link>
      {event.registration_url && (
        <div className="flex justify-end border-t border-border px-3 py-2">
          <RegisterLink href={event.registration_url} />
        </div>
      )}
    </div>
  );
}

/**
 * A "Reserve a table" call-to-action on a post — the dining parallel to the
 * event Register button. Internal link to the concierge reservation flow, so a
 * dinner-special post hands off to in-app booking instead of an email in prose.
 */
function PostReservationCta() {
  return (
    <div className="mt-3">
      <Link href="/reservations" className="btn btn-primary btn-sm">
        Reserve a table <UtensilsIcon />
      </Link>
    </div>
  );
}

/**
 * The firm version of the Reserve-a-table CTA: a staff-flagged night that needs
 * a booking. Names the date and links straight to the form, so an announcement
 * that a table is required can't be lost in the prose above.
 */
function PostReservationRequired({ date }: { date: string }) {
  return (
    <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <p className="text-sm font-semibold text-foreground">
        Reservations required · {formatDate(date)}
      </p>
      <div className="mt-2">
        <Link href="/reservations" className="btn btn-primary btn-sm">
          Reserve a table <UtensilsIcon />
        </Link>
      </div>
    </div>
  );
}

// Same fork-and-knife glyph as the buffet card's UtensilsGlyph, sized for a
// button so the dining cue is consistent across the app.
function UtensilsIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
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
