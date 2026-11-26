import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DepartmentBadge } from "@/components/badges";
import { PageHeader } from "@/components/page-header";
import { AddToCalendar } from "@/components/calendar/add-to-calendar";
import { EventActions } from "@/components/event-actions";
import { EventCover, RegisterLink } from "@/components/event-card";
import { EventRsvpButton } from "@/components/event-rsvp-button";
import { isStaff, requireProfile } from "@/lib/auth";
import { signupStatus } from "@/lib/events";
import {
  clubTodayISO,
  formatDate,
  formatTimeRange,
  formatTimestamp,
} from "@/lib/format";
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
  const mine = (rsvps ?? []).find((r) => r.member_id === profile.id);
  const going = !!mine;
  const headcount = (rsvps ?? []).reduce((sum, r) => sum + r.party_size, 0);

  // Capped events publish their fill ("18 spots left") through a definer RPC —
  // the aggregate only; the rows stay own-or-staff.
  const { data: availRows } =
    event.capacity != null
      ? await supabase.rpc("get_event_availability", { p_event_id: id })
      : { data: null };
  const avail = availRows?.[0] ?? null;
  const status = signupStatus({
    capacity: avail?.capacity ?? null,
    taken: avail?.taken ?? 0,
    deadline: event.signup_deadline,
    now: new Date().toISOString(),
    upcoming,
  });

  // Own waitlist row for a member; every row for staff (RLS: own-or-staff).
  const { data: waitlist } =
    event.capacity != null
      ? await supabase
          .from("event_waitlist")
          .select("member_id, party_size, created_at")
          .eq("event_id", id)
          .order("created_at")
      : { data: [] };
  const myWait = (waitlist ?? []).find((w) => w.member_id === profile.id);

  // Someone already on the list keeps a way off it, even once the event moved
  // to its own sign-up link. The headcount itself outlives the event — staff
  // reconcile covers against it the morning after.
  const showRsvpButton = canRsvp || (going && upcoming) || (!!myWait && upcoming);
  const showHeadcount = canRsvp || headcount > 0;

  // Staff see who's coming; the name lookup is theirs alone (profiles is
  // readable by self + staff), so it only runs for them.
  const attendeeIds = canManage
    ? [
        ...(rsvps ?? []).map((r) => r.member_id),
        ...(waitlist ?? []).map((w) => w.member_id),
      ]
    : [];
  const { data: attendees } = attendeeIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", attendeeIds)
    : { data: [] };
  const nameOf = new Map((attendees ?? []).map((a) => [a.id, a.full_name]));
  const withParty = (memberId: string, n: number) =>
    `${nameOf.get(memberId) ?? "Member"}${n > 1 ? ` (${n})` : ""}`;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={event.title}
        eyebrow={formatDate(event.event_date)}
        back={{ href: "/calendar", label: "Calendar" }}
      />

      <article className="space-y-8">
        {event.cover_image_url && (
          <div className="overflow-hidden rounded-lg">
            <EventCover url={event.cover_image_url} eager />
          </div>
        )}

        {/* The particulars, set as a ruled list like the dining menu. */}
        <dl className="rule-list">
          <DetailRow label="When">
            {formatTimeRange(event.start_time, event.end_time)}
          </DetailRow>
          {event.location && (
            <DetailRow label="Where">{event.location}</DetailRow>
          )}
          {event.fee && <DetailRow label="Fee">{event.fee}</DetailRow>}
          {event.signup_deadline && (
            <DetailRow label="Sign up by">
              {formatTimestamp(event.signup_deadline)}
            </DetailRow>
          )}
          {/* Same note the golf season schedule carries — "Field full ·
              162/162" is exactly what a member opening the event wants. */}
          {event.schedule_note && (
            <DetailRow label="Note">{event.schedule_note}</DetailRow>
          )}
          {event.department && (
            <DetailRow label="Department">
              <DepartmentBadge department={event.department} />
            </DetailRow>
          )}
        </dl>

        {event.description && (
          <p className="text-body text-[1.02rem] leading-relaxed whitespace-pre-wrap text-foreground/85">
            {event.description}
          </p>
        )}

        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/70 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              {event.registration_url && (
                <RegisterLink href={event.registration_url} />
              )}
              {showRsvpButton && (
                <EventRsvpButton
                  eventId={event.id}
                  goingParty={mine?.party_size ?? null}
                  waitlistParty={myWait?.party_size ?? null}
                  canAdd={canRsvp}
                  state={status.state}
                  spotsLeft={status.spotsLeft}
                />
              )}
              <AddToCalendar event={event} />
            </div>
            {canManage && <EventActions id={event.id} redirectTo="/calendar" />}
          </div>

          {/* Staff-only: the headcount this RSVP feeds. Members never see who
              else is coming — see the event_rsvps RLS. */}
          {canManage && showHeadcount && (
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="eyebrow text-[0.66rem]">
                {canRsvp ? "Coming along" : "Said they were coming"}
              </p>
              {headcount === 0 ? (
                <p className="mt-1 text-sm text-muted">
                  No one has said they&rsquo;re coming yet.
                </p>
              ) : (
                <>
                  <p className="mt-2 font-serif text-2xl text-foreground">
                    {headcount} {headcount === 1 ? "person" : "people"}
                    {event.capacity != null && (
                      <span className="text-base text-muted"> of {event.capacity}</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {(rsvps ?? [])
                      .map((r) => withParty(r.member_id, r.party_size))
                      .join(", ")}
                  </p>
                </>
              )}
              {(waitlist ?? []).length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="eyebrow text-[0.66rem]">
                    Waitlist ·{" "}
                    {(waitlist ?? []).reduce((n, w) => n + w.party_size, 0)} people
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {(waitlist ?? [])
                      .map((w) => withParty(w.member_id, w.party_size))
                      .join(", ")}
                  </p>
                </div>
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

/** One label/value line in the event's ruled particulars list. */
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3.5">
      <dt className="shrink-0 text-[0.92rem] tracking-[0.03em] text-muted">
        {label}
      </dt>
      <dd className="text-right text-[0.95rem] font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}
