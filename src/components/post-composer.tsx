"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  createPost,
  updatePost,
  type AttachmentInput,
} from "@/app/(app)/posts/actions";
import { PostCard } from "@/components/post-card";
import { cn } from "@/lib/cn";
import { CLUB_NAME, DEPARTMENTS, POST_TEMPLATES } from "@/lib/constants";
import {
  clubLocalInputValue,
  clubTodayISO,
  formatDateShort,
} from "@/lib/format";
import {
  ACCEPT_ATTR,
  classifyFile,
  uploadPostFile,
  validateFile,
} from "@/lib/upload";
import type {
  AttachmentKind,
  CalendarEvent,
  DepartmentType,
  FeedPost,
  PostAttachment,
  PostAuthor,
  PostAuthorType,
  PostStatus,
} from "@/lib/database.types";

type ExistingPost = {
  id: string;
  department: DepartmentType;
  author_type: PostAuthorType;
  title: string | null;
  content: string;
  is_pinned: boolean;
  event_id: string | null;
  reservation_cta: boolean;
  reservation_required_date: string | null;
  status: PostStatus;
  publish_at: string | null;
  attachments: PostAttachment[];
};

/**
 * The events a post can link to. Carries the fields the live PostEventCard reads
 * so the composer preview can render the real event card, not an approximation.
 */
export type EventOption = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  fee: string | null;
  registration_url: string | null;
};

/** Lifecycle intent chosen at submit time. */
type SubmitIntent = "publish" | "draft" | "schedule";

/** Seed values for a fresh post duplicated from an existing one ("use as
 * template"). Text/category/voice only — attachments are not carried over. */
export type InitialPost = {
  department: DepartmentType;
  title: string;
  content: string;
  asClub: boolean;
};

type Draft = {
  localId: string;
  file: File;
  kind: AttachmentKind;
  previewUrl?: string;
};

export function PostComposer({
  userId,
  post,
  initial,
  events = [],
  previewAuthor,
}: {
  userId: string;
  post?: ExistingPost;
  initial?: InitialPost;
  events?: EventOption[];
  /** The signed-in staffer's display fields, for the preview byline. */
  previewAuthor: PostAuthor;
}) {
  const isEdit = !!post;
  // A published post is live; keep its editor simple ("Save changes"). New posts
  // and drafts/scheduled posts get the full publish / draft / schedule choice.
  const canScheduleFlow = !post || post.status !== "published";

  // Field precedence: editing an existing post > duplicate seed > blank defaults.
  const [department, setDepartment] = useState<DepartmentType>(
    post?.department ?? initial?.department ?? "general",
  );
  const [title, setTitle] = useState(post?.title ?? initial?.title ?? "");
  const [content, setContent] = useState(post?.content ?? initial?.content ?? "");
  const [isPinned, setIsPinned] = useState(post?.is_pinned ?? false);
  const [eventId, setEventId] = useState(post?.event_id ?? "");
  const [reservationCta, setReservationCta] = useState(
    post?.reservation_cta ?? false,
  );
  // "Reservations required" exceptions: a checkbox that reveals the date field.
  const [reservationRequired, setReservationRequired] = useState(
    !!post?.reservation_required_date,
  );
  const [reservationRequiredDate, setReservationRequiredDate] = useState(
    post?.reservation_required_date ?? "",
  );
  // New posts speak for the club by default; staff can switch to a personal post.
  const [asClub, setAsClub] = useState(
    post ? post.author_type === "club" : initial?.asClub ?? true,
  );

  // Edit vs. live preview (renders the real member-facing card).
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  // Scheduling: a disclosure revealing a datetime picker. Pre-open + pre-fill
  // when editing an already-scheduled post so its time shows for adjustment.
  const [scheduleOpen, setScheduleOpen] = useState(post?.status === "scheduled");
  const [scheduleAt, setScheduleAt] = useState(
    post?.publish_at ? clubLocalInputValue(post.publish_at) : "",
  );

  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Built-in starter templates (new posts only). Applying one overwrites the
  // category, body, and voice; the author then fills in the blanks.
  function applyTemplate(key: string) {
    const tpl = POST_TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    setDepartment(tpl.department);
    setContent(tpl.body);
    setAsClub(tpl.asClub);
  }

  // Markdown toolbar: wrap the current selection (or a placeholder) with syntax
  // and restore the selection so the author can keep typing.
  function surroundSelection(before: string, after: string, placeholder: string) {
    const ta = contentRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const chosen = content.slice(s, e) || placeholder;
    const next = content.slice(0, s) + before + chosen + after + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const from = s + before.length;
      ta.setSelectionRange(from, from + chosen.length);
    });
  }

  function insertLink() {
    const ta = contentRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const label = content.slice(s, e) || "link text";
    const snippet = `[${label}](https://)`;
    setContent(content.slice(0, s) + snippet + content.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      // Drop the caret inside the empty (…) so the author types the URL next.
      const urlStart = s + label.length + 3; // "[" + label + "]("
      ta.setSelectionRange(urlStart, urlStart + "https://".length);
    });
  }

  function bulletList() {
    const ta = contentRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const lineStart = content.lastIndexOf("\n", s - 1) + 1;
    const block = content.slice(lineStart, e);
    const listed = block
      .split("\n")
      .map((l) => (l.trim() ? `- ${l}` : l))
      .join("\n");
    setContent(content.slice(0, lineStart) + listed + content.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + listed.length);
    });
  }

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => {
      drafts.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keptExisting = (post?.attachments ?? []).filter(
    (a) => !removedIds.has(a.id),
  );

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next: Draft[] = [];
    for (const file of Array.from(list)) {
      const problem = validateFile(file);
      const kind = classifyFile(file);
      if (problem || !kind) {
        setError(problem ?? `${file.name}: unsupported file type`);
        continue;
      }
      next.push({
        localId: crypto.randomUUID(),
        file,
        kind,
        previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
      });
    }
    if (next.length) setDrafts((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeDraft(localId: string) {
    setDrafts((prev) => {
      const target = prev.find((d) => d.localId === localId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((d) => d.localId !== localId);
    });
  }

  function removeExisting(id: string) {
    setRemovedIds((prev) => new Set(prev).add(id));
  }

  async function handleSubmit(intent: SubmitIntent) {
    if (submitting) return;
    setError(null);

    const hasSomething =
      title.trim() ||
      content.trim() ||
      drafts.length > 0 ||
      keptExisting.length > 0;
    if (!hasSomething) {
      setError("Add a title, some text, or at least one attachment.");
      return;
    }

    // A draft can be empty-of-schedule; a scheduled post needs a time.
    const status: PostStatus =
      intent === "draft"
        ? "draft"
        : intent === "schedule"
          ? "scheduled"
          : "published";
    if (status === "scheduled" && !scheduleAt) {
      setError("Pick a date and time to schedule this post.");
      return;
    }

    setSubmitting(true);

    // Upload new files one at a time (gentler on phone connections).
    const uploaded: AttachmentInput[] = [];
    for (const draft of drafts) {
      setUploadingName(draft.file.name);
      try {
        uploaded.push(await uploadPostFile(draft.file, userId));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : `Couldn't upload ${draft.file.name}.`,
        );
        setSubmitting(false);
        setUploadingName(null);
        return;
      }
    }
    setUploadingName(null);

    const base = {
      department,
      authorType: (asClub ? "club" : "member") as PostAuthorType,
      title: title.trim(),
      content: content.trim(),
      isPinned,
      eventId: eventId || null,
      reservationCta,
      reservationRequiredDate:
        reservationRequired && reservationRequiredDate
          ? reservationRequiredDate
          : null,
      status,
      publishAt: status === "scheduled" ? scheduleAt : null,
      attachments: uploaded,
    };

    const result = isEdit
      ? await updatePost(post!.id, {
          ...base,
          removedAttachmentIds: [...removedIds],
        })
      : await createPost(base);

    // On success the action redirects; only an error returns here.
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  // Assemble a member-facing post from the live form state for the preview tab —
  // draft image attachments use their local object URLs; the linked event is the
  // selected option cast to the shape PostEventCard reads.
  const previewAttachments: PostAttachment[] = [
    ...keptExisting,
    ...drafts.map((d, i) => ({
      id: d.localId,
      post_id: "preview",
      kind: d.kind,
      url: d.previewUrl ?? "#",
      storage_path: "",
      file_name: d.file.name,
      mime_type: d.file.type || null,
      size_bytes: d.file.size,
      width: null,
      height: null,
      position: 1_000 + i,
      created_at: "",
    })),
  ];
  const selectedEvent = events.find((ev) => ev.id === eventId) ?? null;
  const previewPost: FeedPost = {
    id: "preview",
    author_id: "preview",
    author_type: asClub ? "club" : "member",
    department,
    title: title.trim() || null,
    content: content.trim(),
    image_url: null,
    pdf_url: null,
    event_id: eventId || null,
    reservation_cta: reservationCta,
    reservation_required_date:
      reservationRequired && reservationRequiredDate
        ? reservationRequiredDate
        : null,
    is_pinned: isPinned,
    status: "published",
    publish_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    post_attachments: previewAttachments,
    author: previewAuthor,
    event: selectedEvent
      ? (selectedEvent as unknown as CalendarEvent)
      : null,
  };

  const busyLabel = uploadingName ? "Uploading…" : "Saving…";

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="card space-y-5 p-5 sm:p-6"
    >
      {/* Edit / Preview tabs */}
      <div
        role="tablist"
        aria-label="Compose or preview"
        className="flex gap-1 rounded-lg bg-surface-2 p-1"
      >
        {(["edit", "preview"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition",
              mode === m
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "preview" && (
        <div>
          <PostCard post={previewPost} currentUserId="" canManageAny={false} />
          <p className="field-hint mt-3">
            This is how members will see the post. Attachments show your local
            copies until you publish.
          </p>
        </div>
      )}

      <div className={cn("space-y-5", mode === "preview" && "hidden")}>
      {!isEdit && POST_TEMPLATES.length > 0 && (
        <div>
          <label className="label" htmlFor="template">
            Start from a template{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <select
            id="template"
            className="select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyTemplate(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Blank post</option>
            {POST_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Pre-fills the category and a starter message you can edit.
          </p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="department">
          Category
        </label>
        <select
          id="department"
          className="select"
          value={department}
          onChange={(e) => setDepartment(e.target.value as DepartmentType)}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="content">
          What&rsquo;s the update?
        </label>
        <div className="mb-1.5 flex flex-wrap gap-1">
          <ToolbarButton label="Bold" onClick={() => surroundSelection("**", "**", "bold text")}>
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => surroundSelection("_", "_", "italic text")}>
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton label="Link" onClick={insertLink}>
            Link
          </ToolbarButton>
          <ToolbarButton label="Bulleted list" onClick={bulletList}>
            • List
          </ToolbarButton>
        </div>
        <textarea
          id="content"
          ref={contentRef}
          className="textarea min-h-32"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={5000}
          placeholder="Share news, photos, or a document with members…"
        />
        <p className="field-hint">
          Formatting: **bold**, _italic_, [links](https://…), and - lists.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="title">
          Headline <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="title"
          type="text"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          placeholder="e.g. Summer tournament sign-ups open"
        />
      </div>

      {/* Attachments */}
      <div>
        <span className="label">Photos &amp; files</span>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="rounded-lg border border-dashed border-border bg-surface-2 p-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
            id="file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-outline btn-sm w-full"
          >
            + Add photos or files
          </button>
          <p className="field-hint">
            Images and documents (PDF, Word, Excel…), up to 25&nbsp;MB each.
          </p>

          {(keptExisting.length > 0 || drafts.length > 0) && (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {keptExisting.map((att) => (
                <PreviewTile
                  key={att.id}
                  kind={att.kind}
                  src={att.kind === "image" ? att.url : undefined}
                  name={att.file_name ?? "File"}
                  onRemove={() => removeExisting(att.id)}
                />
              ))}
              {drafts.map((d) => (
                <PreviewTile
                  key={d.localId}
                  kind={d.kind}
                  src={d.previewUrl}
                  name={d.file.name}
                  onRemove={() => removeDraft(d.localId)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {events.length > 0 && (
        <div>
          <label className="label" htmlFor="event">
            Link an event{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <select
            id="event"
            className="select"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            <option value="">— None —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} — {formatDateShort(ev.event_date)}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Adds the event&rsquo;s date and a Register button to this post.
          </p>
        </div>
      )}

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={reservationCta}
            onChange={(e) => setReservationCta(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Add a &ldquo;Reserve a table&rdquo; button
        </label>
        <p className="field-hint">
          Links members straight to the dining reservation form.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={reservationRequired}
            onChange={(e) => setReservationRequired(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Reservations required
        </label>
        <p className="field-hint">
          For a night that needs a booking (a special dinner, a Sunday lunch).
          Friday &amp; Saturday dinner already show this automatically.
        </p>
        {reservationRequired && (
          <input
            type="date"
            value={reservationRequiredDate}
            min={clubTodayISO()}
            onChange={(e) => setReservationRequiredDate(e.target.value)}
            aria-label="Date reservations are required"
            className="input mt-2 max-w-xs"
          />
        )}
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={asClub}
            onChange={(e) => setAsClub(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Post as {CLUB_NAME}
        </label>
        <p className="field-hint">
          On for official club news. Turn off to post under your own name.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={isPinned}
          onChange={(e) => setIsPinned(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Pin to top of feed
      </label>
      </div>

      {/* Scheduling (not offered for an already-live post) */}
      {canScheduleFlow && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={scheduleOpen}
              onChange={(e) => setScheduleOpen(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Schedule for later
          </label>
          <p className="field-hint">
            Save it now; it goes live automatically at the time you pick.
          </p>
          {scheduleOpen && (
            <input
              type="datetime-local"
              value={scheduleAt}
              min={clubLocalInputValue(new Date().toISOString())}
              onChange={(e) => setScheduleAt(e.target.value)}
              aria-label="Publish date and time"
              className="input mt-2 max-w-xs"
            />
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {canScheduleFlow && scheduleOpen ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit("schedule")}
            className="btn btn-primary"
          >
            {submitting ? busyLabel : "Schedule"}
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit("publish")}
            className="btn btn-primary"
          >
            {submitting
              ? busyLabel
              : isEdit && !canScheduleFlow
                ? "Save changes"
                : "Publish now"}
          </button>
        )}

        {canScheduleFlow && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit("draft")}
            className="btn btn-outline"
          >
            Save as draft
          </button>
        )}

        <Link href="/posts" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded border border-border bg-surface px-2.5 py-1 text-sm text-foreground/80 transition hover:bg-surface-2 hover:text-foreground"
    >
      {children}
    </button>
  );
}

function PreviewTile({
  kind,
  src,
  name,
  onRemove,
}: {
  kind: AttachmentKind;
  src?: string;
  name: string;
  onRemove: () => void;
}) {
  return (
    <li className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface">
      {kind === "image" && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div
          className={cn(
            "flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center",
          )}
        >
          <span className="text-2xl" aria-hidden>
            📄
          </span>
          <span className="line-clamp-2 break-all text-2xs leading-tight text-muted">
            {name}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm leading-none text-white hover:bg-black/80"
      >
        ×
      </button>
    </li>
  );
}
