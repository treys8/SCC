import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateEvent } from "@/app/(app)/calendar/actions";
import { EventForm } from "@/components/event-form";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRole("staff", "admin");

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const action = updateEvent.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit event" />
      <EventForm
        action={action}
        event={event}
        userId={profile.id}
        submitLabel="Save changes"
      />
    </div>
  );
}
