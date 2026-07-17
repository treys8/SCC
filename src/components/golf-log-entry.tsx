"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addLogComment,
  setIssueResolved,
  shareEntryWithMembers,
} from "@/app/(app)/manage/golf-log/actions";
import { cn } from "@/lib/cn";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import type { GolfLogKind } from "@/lib/database.types";

export type GolfLogEntryView = {
  id: string;
  kind: GolfLogKind;
  area: string | null;
  note: string;
  photo_url: string | null;
  resolved: boolean;
  created_at: string;
  authorName: string;
  /** The member-facing post this was shared to, if it has been. */
  sharedPostId: string | null;
  comments: {
    id: string;
    authorName: string;
    body: string;
    created_at: string;
  }[];
};

/**
 * One log entry: a done item or an issue (open or resolved), with its photo,
 * comment thread, and a reply box. The author/admin can resolve or reopen issues;
 * leadership and the author can comment.
 *
 * `canShare` (the superintendent) adds "Share with members", which publishes the
 * entry to the golf feed. The log itself stays private either way.
 */
export function GolfLogEntry({
  entry,
  canManage,
  canComment,
  canShare = false,
}: {
  entry: GolfLogEntryView;
  canManage: boolean;
  canComment: boolean;
  canShare?: boolean;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingShare, setConfirmingShare] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isOpenIssue = entry.kind === "issue" && !entry.resolved;

  function share() {
    setError(null);
    startTransition(async () => {
      try {
        await shareEntryWithMembers(entry.id);
        setConfirmingShare(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't share that.");
      }
    });
  }

  function resolve(resolved: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setIssueResolved(entry.id, resolved);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't update that.");
      }
    });
  }

  function sendComment() {
    const text = comment.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      try {
        await addLogComment(entry.id, text);
        setComment("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't post that.");
      }
    });
  }

  return (
    <div
      className={cn(
        "card p-4",
        isOpenIssue && "border-l-4 border-l-danger",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={entry.kind} resolved={entry.resolved} />
          {entry.area && (
            <span className="badge bg-surface-2 text-muted">{entry.area}</span>
          )}
        </div>
        {canManage && entry.kind === "issue" && (
          <button
            type="button"
            onClick={() => resolve(!entry.resolved)}
            disabled={pending}
            className="btn btn-ghost btn-sm text-muted"
          >
            {entry.resolved ? "Reopen" : "Mark resolved"}
          </button>
        )}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-foreground">{entry.note}</p>

      {entry.photo_url && (
        <a
          href={entry.photo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.photo_url}
            alt="Log photo"
            className="max-h-48 max-w-full rounded-lg border border-border object-cover"
          />
        </a>
      )}

      <p className="mt-2 text-caption text-muted">
        {entry.authorName} ·{" "}
        <span title={formatTimestamp(entry.created_at)}>
          {formatRelativeTime(entry.created_at)}
        </span>
      </p>

      {/* Sharing publishes to every member, so it asks first. */}
      {entry.sharedPostId ? (
        <p className="mt-2 text-caption text-success">
          ✓ Shared with members ·{" "}
          <Link href={`/posts/${entry.sharedPostId}`} className="underline">
            View the post
          </Link>
        </p>
      ) : (
        canShare &&
        (confirmingShare ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">
              Publish this to the members&rsquo; golf feed?
            </span>
            <button
              type="button"
              onClick={() => setConfirmingShare(false)}
              disabled={pending}
              className="btn btn-ghost btn-sm"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={share}
              disabled={pending}
              className="btn btn-primary btn-sm"
            >
              {pending ? "Sharing…" : "Share it"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingShare(true)}
            className="btn btn-outline btn-sm mt-2"
          >
            Share with members
          </button>
        ))
      )}

      {(entry.comments.length > 0 || canComment) && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {entry.comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium text-foreground">
                {c.authorName}
              </span>{" "}
              <span
                className="text-caption text-muted"
                title={formatTimestamp(c.created_at)}
              >
                {formatRelativeTime(c.created_at)}
              </span>
              <p className="whitespace-pre-wrap text-foreground">{c.body}</p>
            </div>
          ))}

          {canComment && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendComment();
                  }
                }}
                placeholder="Add a comment…"
                className="input"
                disabled={pending}
              />
              <button
                type="button"
                onClick={sendComment}
                disabled={pending || !comment.trim()}
                className="btn btn-outline btn-sm shrink-0"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function KindBadge({
  kind,
  resolved,
}: {
  kind: GolfLogKind;
  resolved: boolean;
}) {
  if (kind === "done") {
    return <span className="badge bg-success/10 text-success">Done</span>;
  }
  return resolved ? (
    <span className="badge bg-surface-2 text-muted">Resolved</span>
  ) : (
    <span className="badge bg-danger/10 text-danger">Open issue</span>
  );
}
