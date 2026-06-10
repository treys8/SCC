"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  setFacilityMessage,
  setFacilityStatus,
} from "@/app/(app)/facility/actions";
import { FacilityStatusBadge } from "@/components/badges";
import { cn } from "@/lib/cn";
import { FACILITY_LABEL, FACILITY_PRESETS } from "@/lib/constants";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  FacilityStatus,
  FacilityStatusType,
} from "@/lib/database.types";

/**
 * Pinned, realtime facility status (golf / pool). Reusable: members get the
 * read-only view; staff pass `canManage` for one-tap preset controls. Built to
 * drop into Phase 4's "Today at the Club" home unchanged.
 *
 * Seeds from server-fetched rows, then merges live UPDATEs pushed when staff
 * change a status — the actor is NOT filtered out, so their own change lands
 * immediately on every surface.
 */
export function FacilityStatusWidget({
  initial,
  canManage = false,
}: {
  initial: FacilityStatus[];
  canManage?: boolean;
}) {
  const [rows, setRows] = useState(initial);

  const mergeRow = (next: FacilityStatus) =>
    setRows((prev) =>
      prev.map((r) => (r.facility === next.facility ? next : r)),
    );

  // Realtime: facility_status is authenticated-read, so the socket is RLS-gated
  // by the user's JWT — set it before subscribing (same pattern as the feed).
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel("facility-status")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "facility_status" },
          (payload) => {
            // Realtime sends timestamptz in Postgres' raw text format
            // ("2026-06-10 00:36:11.638+00"), which iOS Safari's Date parser
            // rejects. The update just arrived, so stamp it with the client's
            // own ISO receipt time for a parse-safe, accurate "Updated …".
            const next = payload.new as FacilityStatus;
            mergeRow({ ...next, updated_at: new Date().toISOString() });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-h2 text-foreground">
          Course &amp; Pool
        </h2>
        <span className="text-caption font-medium uppercase tracking-wide text-muted">
          Live status
        </span>
      </header>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <FacilityRow
            key={row.facility}
            row={row}
            canManage={canManage}
            onOptimistic={mergeRow}
          />
        ))}
      </ul>
    </section>
  );
}

function FacilityRow({
  row,
  canManage,
  onOptimistic,
}: {
  row: FacilityStatus;
  canManage: boolean;
  onOptimistic: (next: FacilityStatus) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(row.message ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the note input in sync with realtime updates to row.message — unless
  // this staffer is actively editing it — so a remote clear/change isn't
  // resurrected by a stale local draft.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(row.message ?? "");
    }
  }, [row.message]);

  // A staffer's own change should look instant; realtime then reconciles with
  // the authoritative row. A client timestamp is fine for the optimistic gap.
  const stamp = () => new Date().toISOString();

  const applyStatus = (status: FacilityStatusType) => {
    onOptimistic({ ...row, status, message: null, updated_at: stamp() });
    setDraft("");
    startTransition(async () => {
      try {
        await setFacilityStatus(row.facility, status);
      } catch (e) {
        console.error("facility status update failed:", e);
      }
    });
  };

  const saveMessage = () => {
    const message = draft.trim();
    onOptimistic({ ...row, message: message || null, updated_at: stamp() });
    startTransition(async () => {
      try {
        await setFacilityMessage(row.facility, message);
      } catch (e) {
        console.error("facility message update failed:", e);
      }
    });
  };

  return (
    <li className={cn("px-4 py-4 sm:px-5", isPending && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {FACILITY_LABEL[row.facility]}
          </p>
          {row.message && (
            <p className="mt-0.5 text-sm text-muted">{row.message}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <FacilityStatusBadge status={row.status} />
          <time
            dateTime={row.updated_at}
            title={formatTimestamp(row.updated_at)}
            suppressHydrationWarning
            className="text-caption text-muted"
          >
            Updated {formatRelativeTime(row.updated_at)}
          </time>
        </div>
      </div>

      {canManage && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {FACILITY_PRESETS.map((preset, i) => {
              // Highlight only the canonical preset for the current status, so
              // "Open" and "All clear" (both -> open) don't both light up.
              const isCanonical =
                FACILITY_PRESETS.findIndex((p) => p.status === preset.status) ===
                i;
              const active = row.status === preset.status && isCanonical;
              return (
                <button
                  key={preset.label}
                  type="button"
                  disabled={isPending}
                  aria-pressed={active}
                  onClick={() => applyStatus(preset.status)}
                  className={cn(
                    "btn btn-sm",
                    active ? "btn-primary" : "btn-outline",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={120}
              placeholder="Add a note (e.g. Cart path only)"
              aria-label={`${FACILITY_LABEL[row.facility]} status note`}
              className="input"
            />
            <button
              type="button"
              disabled={isPending}
              onClick={saveMessage}
              className="btn btn-outline btn-sm shrink-0"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
