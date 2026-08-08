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

  const upcoming = event.event_date >= clubTodayISO();
  // New RSVPs are for club-run events only — one with a registration_url hands
  // off to GolfGenius, and a second sign-up path would split the count. Only
  // offered while the event is still ahead, too: an RSVP states an intent, and
  // there's nothing left to intend.
  const canRsvp = !event.registration_url && upcoming;

  // RLS returns the member their own row and staff every row, so this one query
  // answers "am I going?" for a member and "who's coming?" for staff. It runs
  // unconditionally: an event that picked up a registration_url *after* members
  // answered still has their rows, and hiding them would cost staff the
  // headcount and trap the members on a list they can't leave.
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("member_id, party_size")
    .eq("event_id", id);
  const going = (rsvps ?? []).some((r) => r.member_id === profile.id);
  const headcount = (rsvps ?? []).reduce((sum, r) => sum + r.party_size, 0);
  // Someone already on the list keeps a way off it, even once the event moved
  // to its own sign-up link. The headcount itself outlives the event — staff
  // reconcile covers against it the morning after.
  const showRsvpButton = canRsvp || (going && upcoming);
  const showHeadcount = canRsvp || headcount > 0;

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
              {/* Same note the golf season schedule carries — "Field full ·
                  162/162" is exactly what a member opening the event wants. */}
              {event.schedule_note && (
                <p className="mt-0.5 text-caption text-muted">
                  {event.schedule_note}
                </p>
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
              {showRsvpButton && (
                <EventRsvpButton
                  eventId={event.id}
                  initialGoing={going}
                  canAdd={canRsvp}
                />
              )}
              <AddToCalendar event={event} />
            </div>
            {canManage && <EventActions id={event.id} redirectTo="/calendar" />}
          </div>

          {/* Staff-only: the headcount this RSVP feeds. Members never see who
              else is coming — see the event_rsvps RLS. */}
          {canManage && showHeadcount && (
            <div className="rounded-lg border border-border bg-surface-2 p-4">
              <p className="text-caption font-semibold uppercase tracking-wide text-muted">
                {canRsvp ? "Coming along" : "Said they were coming"}
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
              {/* Explains a headcount on an event that now points at its own
                  sign-up link — otherwise it reads as a live, growing count. */}
              {event.registration_url && (
                <p className="mt-2 text-caption text-muted">
                  Collected before this event moved to its sign-up link. New
                  sign-ups go through Register.
                </p>
              )}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
