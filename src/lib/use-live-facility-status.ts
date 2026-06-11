"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FacilityStatus } from "@/lib/database.types";

/**
 * Seeds from server-fetched facility rows, then merges live UPDATEs pushed when
 * staff change a status — so the card updates without a reload on every surface
 * that renders it (the Feed and the /facility console).
 *
 * Returns `[rows, mergeRow]`: `mergeRow` lets a caller apply an optimistic local
 * change (staff preset/note edits) that realtime then reconciles.
 */
export function useLiveFacilityStatus(initial: FacilityStatus[]) {
  const [rows, setRows] = useState(initial);

  const mergeRow = useCallback(
    (next: FacilityStatus) =>
      setRows((prev) =>
        prev.map((r) => (r.facility === next.facility ? next : r)),
      ),
    [],
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
  }, [mergeRow]);

  return [rows, mergeRow] as const;
}
