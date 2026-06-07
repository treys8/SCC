import type { Metadata } from "next";
import { createEvent } from "@/app/(app)/calendar/actions";
import { EventForm } from "@/components/event-form";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireRole("staff", "admin");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New event" />
      <EventForm action={createEvent} submitLabel="Add event" />
    </div>
  );
}
