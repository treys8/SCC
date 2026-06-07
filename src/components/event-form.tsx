"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EventFormState } from "@/app/(app)/calendar/actions";
import { SubmitButton } from "@/components/submit-button";
import { DEPARTMENTS } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import type { CalendarEvent } from "@/lib/database.types";

type EventAction = (
  state: EventFormState,
  formData: FormData,
) => Promise<EventFormState>;

const INITIAL: EventFormState = {};

export function EventForm({
  action,
  event,
  submitLabel,
}: {
  action: EventAction;
  event?: CalendarEvent;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

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

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
        <Link href="/calendar" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
