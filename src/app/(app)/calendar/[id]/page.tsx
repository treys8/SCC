import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DepartmentBadge } from "@/components/badges";
import { AddToCalendar } from "@/components/calendar/add-to-calendar";
import { DateChip } from "@/components/calendar/date-chip";
import { EventActions } from "@/components/event-actions";
import { EventCover, RegisterLink } from "@/components/event-card";
import { EventRsvpButton } from "@/components/event-rsvp-button";
import { isStaff, requireProfile } from "@/lib/auth";
import { clubTodayISO, formatDate, formatTimeRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("title")
    .eq("id", id)
    .single();
  return { title: data?.title ?? "Event" };
}

export default async function EventDetailPage({ params }: Params) {
  const { id } = await params;
  const profile = await requireProfile();

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", id)
    .single();
  if (!event) notFound();

  const canManage = isStaff(profile.role);

  // RSVPs are for club-run events only — one with a registration_url hands off
  // to GolfGenius, and a second sign-up path would split the count. There's
  // also nothing to RSVP to once the day has passed.
  const canRsvp = !event.registration_url && event.event_date >= clubTodayISO();

  // RLS returns the member their own row and staff every row, so this one query
  // answers "am I going?" for a member and "who's coming?" for staff.
  const { data: rsvps } = canRsvp
    ? await supabase
        .from("event_rsvps")
        .select("member_id, party_size")
        .eq("event_id", id)
    : { data: [] };
  const going = (rsvps ?? []).some((r) => r.member_id === profile.id);
  const headcount = (rsvps ?? []).reduce((sum, r) => sum + r.party_size, 0);

  // Staff see who's coming; the name lookup is theirs alone (profiles is
  // readable by self + staff), so it only runs for them.
  const attendeeIds = canManage ? (rsvps ?? []).map((r) => r.member_id) : [];
  const { data: attendees } = attendeeIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", attendeeIds)
    : { data: [] };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/calendar"
        className="inline-flex items-center gap-1 text-sm font-medium text-accent-600"
      >
        ← Back to calendar
      </Link>

      <article className="card overflow-hidden">
        {event.cover_image_url && (
          <EventCover url={event.cover_image_url} eager />
        )}

        <div className="space-y-5 p-6">
          <div className="flex gap-4">
            <DateChip dateStr={event.event_date} />
            <div className="min-w-0 flex-1">
              <h1 className="text-h1 text-foreground">{event.title}</h1>
              <p className="mt-1 text-sm text-muted">
                {formatDate(event.event_date)} ·{" "}
                {formatTimeRange(event.start_time, event.end_time)}
              </p>
              {event.location && (
                <p className="mt-0.5 text-sm text-muted">{event.location}</p>
              )}
              {event.fee && (
                <p className="mt-0.5 text-sm text-muted">Fee: {event.fee}</p>
              )}
              {event.department && (
                <div className="mt-3">
                  <DepartmentBadge department={event.department} />
                </div>
              )}
            </div>
          </div>

          {event.description && (
            <p className="whitespace-pre-wrap text-body text-foreground/90">
              {event.description}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <div className="flex flex-wrap items-center gap-2">
              {event.registration_url && (
                <RegisterLink href={event.registration_url} />
              )}
              {canRsvp && (
                <EventRsvpButton eventId={event.id} initialGoing={going} />
              )}
              <AddToCalendar event={event} />
            </div>
            {canManage && <EventActions id={event.id} redirectTo="/calendar" />}
          </div>

          {/* Staff-only: the headcount this RSVP feeds. Members never see who
              else is coming — see the event_rsvps RLS. */}
          {canManage && canRsvp && (
            <div className="rounded-lg border border-border bg-surface-2 p-4">
              <p className="text-caption font-semibold uppercase tracking-wide text-muted">
                Coming along
              </p>
              {headcount === 0 ? (
                <p className="mt-1 text-sm text-muted">
                  No one has said they&rsquo;re coming yet.
                </p>
              ) : (
                <>
                  <p className="mt-1 font-medium text-foreground">
                    {headcount} {headcount === 1 ? "member" : "members"}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {(attendees ?? []).map((a) => a.full_name).join(", ")}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
