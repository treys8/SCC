"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  createPost,
  updatePost,
  type AttachmentInput,
} from "@/app/(app)/posts/actions";
import { cn } from "@/lib/cn";
import { CLUB_NAME, DEPARTMENTS } from "@/lib/constants";
import { formatDateShort } from "@/lib/format";
import {
  ACCEPT_ATTR,
  classifyFile,
  uploadPostFile,
  validateFile,
} from "@/lib/upload";
import type {
  AttachmentKind,
  DepartmentType,
  PostAttachment,
  PostAuthorType,
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
  attachments: PostAttachment[];
};

/** The events a post can link to, listed in the composer's selector. */
export type EventOption = { id: string; title: string; event_date: string };

type Draft = {
  localId: string;
  file: File;
  kind: AttachmentKind;
  previewUrl?: string;
};

export function PostComposer({
  userId,
  post,
  events = [],
}: {
  userId: string;
  post?: ExistingPost;
  events?: EventOption[];
}) {
  const isEdit = !!post;

  const [department, setDepartment] = useState<DepartmentType>(
    post?.department ?? "general",
  );
  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [isPinned, setIsPinned] = useState(post?.is_pinned ?? false);
  const [eventId, setEventId] = useState(post?.event_id ?? "");
  const [reservationCta, setReservationCta] = useState(
    post?.reservation_cta ?? false,
  );
  // New posts speak for the club by default; staff can switch to a personal post.
  const [asClub, setAsClub] = useState(post ? post.author_type === "club" : true);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-6">
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
        <textarea
          id="content"
          className="textarea min-h-32"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={5000}
          placeholder="Share news, photos, or a document with members…"
        />
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

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting
            ? uploadingName
              ? "Uploading…"
              : "Publishing…"
            : isEdit
              ? "Save changes"
              : "Publish"}
        </button>
        <Link href="/posts" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
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
