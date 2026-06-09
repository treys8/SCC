import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DepartmentBadge } from "@/components/badges";
import { AddToCalendar } from "@/components/calendar/add-to-calendar";
import { DateChip } from "@/components/calendar/date-chip";
import { EventActions } from "@/components/event-actions";
import { RegisterLink } from "@/components/event-card";
import { isStaff, requireProfile } from "@/lib/auth";
import { formatDate, formatTimeRange } from "@/lib/format";
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
          <div className="relative aspect-[2/1] bg-surface-2">
            <Image
              src={event.cover_image_url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="space-y-5 p-6">
          <div className="flex gap-4">
            <DateChip dateStr={event.event_date} />
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-2xl font-semibold text-foreground">
                {event.title}
              </h1>
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
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {event.description}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <div className="flex flex-wrap items-center gap-2">
              {event.registration_url && (
                <RegisterLink href={event.registration_url} />
              )}
              <AddToCalendar event={event} />
            </div>
            {canManage && <EventActions id={event.id} redirectTo="/calendar" />}
          </div>
        </div>
      </article>
    </div>
  );
}
