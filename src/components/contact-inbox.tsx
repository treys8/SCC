"use client";

import { useTransition } from "react";
import { setMessageResolved } from "@/app/(app)/manage/messages/actions";
import { cn } from "@/lib/cn";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import type { ContactMessageWithMember } from "@/lib/database.types";

export function ContactInbox({
  messages,
}: {
  messages: ContactMessageWithMember[];
}) {
  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <MessageCard key={m.id} message={m} />
      ))}
    </ul>
  );
}

function MessageCard({ message: m }: { message: ContactMessageWithMember }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setMessageResolved(m.id, !m.is_resolved);
    });
  }

  return (
    <li
      className={cn(
        "card p-5",
        !m.is_resolved && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-lg font-semibold text-foreground">
            {m.subject}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {m.member?.full_name ?? "Member"}
            {m.member?.email && (
              <>
                {" · "}
                <a
                  href={`mailto:${m.member.email}`}
                  className="text-primary hover:underline"
                >
                  {m.member.email}
                </a>
              </>
            )}
          </p>
        </div>
        <time
          dateTime={m.created_at}
          title={formatTimestamp(m.created_at)}
          className="shrink-0 text-caption text-muted"
        >
          {formatRelativeTime(m.created_at)}
        </time>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
        {m.message}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={cn("btn", m.is_resolved ? "btn-ghost" : "btn-primary")}
        >
          {pending ? "Saving…" : m.is_resolved ? "Reopen" : "Mark resolved"}
        </button>
        {m.is_resolved && <span className="text-sm text-success">Resolved</span>}
        {m.member?.email && (
          <a
            href={`mailto:${m.member.email}?subject=${encodeURIComponent(
              `Re: ${m.subject}`,
            )}`}
            className="text-sm text-primary hover:underline"
          >
            Reply by email
          </a>
        )}
      </div>
    </li>
  );
}
