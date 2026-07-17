import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import {
  clubDayStartUTC,
  clubTodayISO,
  formatRelativeTime,
  instantDaysAgoISO,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Adoption" };

/**
 * Admin adoption dashboard — the read on whether members are actually using the
 * app (vs. the incumbent). Built on the `member_activity` heartbeat (set from the
 * app layout on each visit) plus engagement counts. Admin-only: per-member
 * activity is sensitive. Every read goes through the user-scoped client, so each
 * source must be staff/admin-readable under RLS — profiles, member_activity,
 * reservations (own-or-staff), and contact_messages (staff policy) all are.
 *
 * Activity is recorded going forward, so the numbers start near zero and fill in
 * as members open the app after the heartbeat shipped.
 */
export default async function AnalyticsPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const todayStartMs = new Date(clubDayStartUTC(clubTodayISO())).getTime();
  const weekAgoMs = new Date(instantDaysAgoISO(7)).getTime();
  const monthAgoMs = new Date(instantDaysAgoISO(30)).getTime();

  const [membersRes, activityRes, reservationsRes, messagesRes, viewsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, account_number")
        .eq("role", "member")
        .order("full_name", { ascending: true }),
      supabase.from("member_activity").select("user_id, last_seen_at"),
      supabase.from("reservations").select("*", { count: "exact", head: true }),
      supabase
        .from("contact_messages")
        .select("*", { count: "exact", head: true }),
      // Post reach over the last 30 days. Rows, not a count, so we can report
      // distinct readers as well as total reads — "40 posts were read" says much
      // less than "12 different members read something".
      supabase
        .from("post_views")
        .select("user_id")
        .gte("seen_at", instantDaysAgoISO(30)),
    ]);

  const members = membersRes.data ?? [];
  // Parse to epoch ms once — last_seen_at is a timestamptz, and the DB and JS
  // serialize it differently (`+00:00`/µs vs `Z`/ms), so string comparison is
  // unsafe. Compare numbers.
  const lastSeenMs = new Map<string, number>();
  for (const a of activityRes.data ?? []) {
    lastSeenMs.set(a.user_id, new Date(a.last_seen_at).getTime());
  }

  const postViews = viewsRes.data ?? [];
  const readers = new Set(postViews.map((v) => v.user_id)).size;

  const total = members.length;
  const signedIn = members.filter((m) => lastSeenMs.has(m.id)).length;
  const activeSince = (ms: number) =>
    members.filter((m) => {
      const t = lastSeenMs.get(m.id);
      return t !== undefined && t >= ms;
    }).length;
  const pct = total > 0 ? Math.round((signedIn / total) * 100) : 0;

  // Most-recently-active first; members who've never opened the app sink to the
  // bottom (alphabetical among themselves) — that's the nudge list.
  const rows = members
    .map((m) => ({ ...m, lastSeen: lastSeenMs.get(m.id) ?? null }))
    .sort((a, b) => {
      if (a.lastSeen !== null && b.lastSeen !== null) return b.lastSeen - a.lastSeen;
      if (a.lastSeen !== null) return -1;
      if (b.lastSeen !== null) return 1;
      return a.full_name.localeCompare(b.full_name);
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adoption"
        description="Who's signed in and how members are using the app."
      />

      {total === 0 ? (
        <EmptyState
          title="No members yet"
          description="Invite members from the Members page; activity shows up here once they sign in."
        />
      ) : (
        <>
          {/* Activation: the headline "are members on board" number. */}
          <div className="card space-y-3 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-h2 text-foreground">Members signed in</h2>
              <span className="text-sm text-muted">{pct}%</span>
            </div>
            <p className="text-sm text-muted">
              <span className="text-2xl font-semibold text-foreground">
                {signedIn}
              </span>{" "}
              of {total} members have opened the app.
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Active today" value={activeSince(todayStartMs)} />
            <Stat label="Active this week" value={activeSince(weekAgoMs)} />
            <Stat label="Active this month" value={activeSince(monthAgoMs)} />
            <Stat label="Reservations made" value={reservationsRes.count ?? 0} />
            <Stat label="Messages sent" value={messagesRes.count ?? 0} />
            <Stat label="Read a post (30d)" value={readers} />
            <Stat label="Posts read (30d)" value={postViews.length} />
          </div>

          <MemberActivityTable rows={rows} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-0.5 text-caption text-muted">{label}</div>
    </div>
  );
}

type Row = {
  id: string;
  full_name: string;
  account_number: string | null;
  lastSeen: number | null;
};

function MemberActivityTable({ rows }: { rows: Row[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-h2 text-foreground">Members</h2>

      {/* Mobile: stacked cards. */}
      <div className="space-y-3 md:hidden">
        {rows.map((m) => (
          <div
            key={m.id}
            className="card flex items-center justify-between gap-3 p-4"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">
                {m.full_name}
              </span>
              <span className="block text-caption text-muted">
                {m.account_number ? `#${m.account_number}` : "No account #"}
              </span>
            </span>
            <LastActive value={m.lastSeen} />
          </div>
        ))}
      </div>

      {/* Desktop: full table. */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-caption uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {m.full_name}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {m.account_number ? `#${m.account_number}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <LastActive value={m.lastSeen} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function LastActive({ value }: { value: number | null }): ReactNode {
  if (value === null) {
    return <span className="text-caption text-muted">Never</span>;
  }
  const iso = new Date(value).toISOString();
  return (
    <span className="whitespace-nowrap text-foreground" title={iso}>
      {formatRelativeTime(iso)}
    </span>
  );
}
