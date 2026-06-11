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

// Recover the UI if an upload stalls (storage-js issues a plain fetch with no
// timeout); the underlying request may still finish, but the form unlocks.
const UPLOAD_TIMEOUT_MS = 45_000;

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

  // Fields are controlled so a server-side validation error doesn't wipe them:
  // React 19 resets uncontrolled (<input defaultValue>) fields after a form
  // action returns, which would discard everything the staff member typed.
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventDate, setEventDate] = useState(event?.event_date ?? "");
  const [startTime, setStartTime] = useState(event?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(event?.end_time?.slice(0, 5) ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [department, setDepartment] = useState(event?.department ?? "");
  const [registrationUrl, setRegistrationUrl] = useState(
    event?.registration_url ?? "",
  );
  const [fee, setFee] = useState(event?.fee ?? "");
  const [isHighlight, setIsHighlight] = useState(event?.is_highlight ?? false);

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

    const upload = uploadEventCover(file, userId);
    upload.catch(() => {}); // a stalled upload that loses the race shouldn't surface as unhandled
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const url = await Promise.race([
        upload,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Upload timed out — please try again.")),
            UPLOAD_TIMEOUT_MS,
          );
        }),
      ]);
      setCoverUrl(url);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Couldn't upload the image.",
      );
    } finally {
      clearTimeout(timer);
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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
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
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
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
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
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
            value={location}
            onChange={(e) => setLocation(e.target.value)}
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
            value={department}
            onChange={(e) => setDepartment(e.target.value as typeof department)}
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
            value={registrationUrl}
            onChange={(e) => setRegistrationUrl(e.target.value)}
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
            value={fee}
            onChange={(e) => setFee(e.target.value)}
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
          accept="image/jpeg,image/png,image/webp,image/gif"
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

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="is_highlight"
          checked={isHighlight}
          onChange={(e) => setIsHighlight(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span className="text-sm">
          <span className="font-medium text-foreground">
            Show as Today highlight
          </span>
          <span className="mt-0.5 block text-muted">
            Features this event in a cover card on the member home page, on its
            date.
          </span>
        </span>
      </label>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…" disabled={uploading}>
          {submitLabel}
        </SubmitButton>
        <Link href="/calendar" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
