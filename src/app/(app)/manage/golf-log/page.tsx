import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { GolfLogComposer } from "@/components/golf-log-composer";
import {
  GolfLogEntry,
  type GolfLogEntryView,
} from "@/components/golf-log-entry";
import { PageHeader } from "@/components/page-header";
import { getTitleName, requireTitle } from "@/lib/auth";
import { formatLongDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type {
  GolfLogComment,
  GolfLogEntry as GolfLogEntryRow,
} from "@/lib/database.types";

export const metadata: Metadata = { title: "Golf course log" };

const SUPERINTENDENT = "Golf Course Superintendent";
const LOG_TITLES = [SUPERINTENDENT, "General Manager", "Director of Golf"];

/**
 * The Golf Course Superintendent's daily log. He records "done" items and
 * "issues" (open until resolved); the General Manager and Director of Golf read
 * every entry and comment back. Access (and visibility of the rows) is gated to
 * those three titles plus admins — see requireTitle and the RLS on
 * golf_log_entries / golf_log_comments.
 */
export default async function GolfLogPage() {
  const profile = await requireTitle(...LOG_TITLES);
  const title = await getTitleName();
  const canLog = profile.role === "admin" || title === SUPERINTENDENT;

  const supabase = await createClient();
  const { data: entriesData } = await supabase
    .from("golf_log_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  const entries = (entriesData ?? []) as GolfLogEntryRow[];

  const entryIds = entries.map((e) => e.id);
  const { data: commentsData } = entryIds.length
    ? await supabase
        .from("golf_log_comments")
        .select("*")
        .in("entry_id", entryIds)
        .order("created_at", { ascending: true })
    : { data: [] };
  const comments = (commentsData ?? []) as GolfLogComment[];

  // One name lookup for every author (entries + comments).
  const authorIds = [
    ...new Set([
      ...entries.map((e) => e.author_id),
      ...comments.map((c) => c.author_id),
    ]),
  ];
  const { data: people } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const commentsByEntry = new Map<string, GolfLogComment[]>();
  for (const c of comments) {
    const arr = commentsByEntry.get(c.entry_id) ?? [];
    arr.push(c);
    commentsByEntry.set(c.entry_id, arr);
  }

  const toView = (e: GolfLogEntryRow): GolfLogEntryView => ({
    id: e.id,
    kind: e.kind,
    area: e.area,
    note: e.note,
    photo_url: e.photo_url,
    resolved: e.resolved,
    created_at: e.created_at,
    authorName: nameById.get(e.author_id) ?? "Staff",
    comments: (commentsByEntry.get(e.id) ?? []).map((c) => ({
      id: c.id,
      authorName: nameById.get(c.author_id) ?? "Staff",
      body: c.body,
      created_at: c.created_at,
    })),
  });

  // Open issues carry forward across days; the daily log records what's done and
  // resolved, grouped by date.
  const openIssues = entries
    .filter((e) => e.kind === "issue" && !e.resolved)
    .map(toView);

  const logByDate = new Map<string, GolfLogEntryView[]>();
  for (const e of entries) {
    if (e.kind === "issue" && !e.resolved) continue;
    const arr = logByDate.get(e.entry_date) ?? [];
    arr.push(toView(e));
    logByDate.set(e.entry_date, arr);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Golf course log"
        description={
          canLog
            ? "Log what you did and any issues. The GM and Director of Golf can see and comment."
            : "The superintendent's daily log — what got done and any open issues."
        }
      />

      {canLog && <GolfLogComposer userId={profile.id} />}

      {openIssues.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-foreground">
            Open issues ({openIssues.length})
          </h2>
          <div className="space-y-3">
            {openIssues.map((e) => (
              <GolfLogEntry
                key={e.id}
                entry={e}
                canManage={canLog}
                canComment
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-h2 text-foreground">Daily log</h2>
        {logByDate.size === 0 ? (
          <EmptyState
            icon={<LogIcon />}
            title="Nothing logged yet"
            description={
              canLog
                ? "Use the form above to log your first item."
                : "Entries will appear here as they're logged."
            }
          />
        ) : (
          [...logByDate.entries()].map(([date, dayEntries]) => (
            <div key={date} className="space-y-3">
              <h3 className="text-caption font-semibold uppercase tracking-wide text-muted">
                {formatLongDate(date)}
              </h3>
              {dayEntries.map((e) => (
                <GolfLogEntry
                  key={e.id}
                  entry={e}
                  canManage={canLog}
                  canComment
                />
              ))}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function LogIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M4 5h16M4 12h16M4 19h10" />
    </svg>
  );
}
