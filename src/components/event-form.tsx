"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import type { EventFormState } from "@/app/(app)/calendar/actions";
import { SubmitButton } from "@/components/submit-button";
import { DEPARTMENTS } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { uploadEventCover } from "@/lib/upload";
import type { CalendarEvent } from "@/lib/database.types";

type EventAction = (
  state: EventFormState,
  formData: FormData,
) => Promise<EventFormState>;

const INITIAL: EventFormState = {};

export function EventForm({
  action,
  event,
  userId,
  submitLabel,
}: {
  action: EventAction;
  event?: CalendarEvent;
  userId: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  // Cover photo uploads browser-direct on selection (Server Action bodies are
  // too small for photos); the form only submits the resulting public URL.
  const [coverUrl, setCoverUrl] = useState<string | null>(
    event?.cover_image_url ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      setCoverUrl(await uploadEventCover(file, userId));
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Couldn't upload the image.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="card space-y-5 p-6">
      <div>
        <label className="label" htmlFor="title">
          Event title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={event?.title ?? ""}
          className="input"
          placeholder="Member-Guest Golf Tournament"
        />
      </div>

      <div>
        <label className="label" htmlFor="description">
          Description <span className="text-muted">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={event?.description ?? ""}
          className="textarea"
          placeholder="Details members should know…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="event_date">
            Date
          </label>
          <input
            id="event_date"
            name="event_date"
            type="date"
            required
            min={todayISO()}
            defaultValue={event?.event_date ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="start_time">
            Start time
          </label>
          <input
            id="start_time"
            name="start_time"
            type="time"
            required
            defaultValue={event?.start_time?.slice(0, 5) ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="end_time">
            End time <span className="text-muted">(optional)</span>
          </label>
          <input
            id="end_time"
            name="end_time"
            type="time"
            defaultValue={event?.end_time?.slice(0, 5) ?? ""}
            className="input"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="location">
            Location <span className="text-muted">(optional)</span>
          </label>
          <input
            id="location"
            name="location"
            type="text"
            defaultValue={event?.location ?? ""}
            className="input"
            placeholder="Main Clubhouse"
          />
        </div>
        <div>
          <label className="label" htmlFor="department">
            Department <span className="text-muted">(optional)</span>
          </label>
          <select
            id="department"
            name="department"
            className="select"
            defaultValue={event?.department ?? ""}
          >
            <option value="">None</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="registration_url">
            Registration link <span className="text-muted">(optional)</span>
          </label>
          <input
            id="registration_url"
            name="registration_url"
            type="text"
            inputMode="url"
            defaultValue={event?.registration_url ?? ""}
            className="input"
            placeholder="https://golfgenius.com/…"
          />
          <p className="field-hint">
            Members get a Register button that opens this page.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="fee">
            Fee <span className="text-muted">(optional)</span>
          </label>
          <input
            id="fee"
            name="fee"
            type="text"
            defaultValue={event?.fee ?? ""}
            className="input"
            placeholder="$50 per player"
          />
        </div>
      </div>

      <div>
        <span className="label">
          Cover photo <span className="font-normal text-muted">(optional)</span>
        </span>
        <input type="hidden" name="cover_image_url" value={coverUrl ?? ""} />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={onCoverChange}
          className="hidden"
          id="cover-input"
        />
        {coverUrl ? (
          <div className="relative aspect-[2/1] overflow-hidden rounded-lg border border-border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt="Event cover"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => setCoverUrl(null)}
              aria-label="Remove cover photo"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm leading-none text-white hover:bg-black/80"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploading}
            className="btn btn-outline btn-sm w-full"
          >
            {uploading ? "Uploading…" : "+ Add cover photo"}
          </button>
        )}
        {uploadError && <p className="mt-1 text-sm text-danger">{uploadError}</p>}
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-3">
        {uploading ? (
          <button type="button" disabled className="btn btn-primary">
            Uploading…
          </button>
        ) : (
          <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
        )}
        <Link href="/calendar" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
