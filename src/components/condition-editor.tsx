"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  setFacilityMessage,
  setFacilityStatus,
} from "@/app/(app)/facility/actions";
import { cn } from "@/lib/cn";
import { FACILITY_LABEL, FACILITY_PRESETS } from "@/lib/constants";
import type { FacilityStatus, FacilityStatusType } from "@/lib/database.types";

/** Dot colour per status for the preset chips (matches the strip's tones). */
export const STATUS_DOT: Record<FacilityStatusType, string> = {
  open: "bg-primary",
  closed: "bg-danger",
  frost_delay: "bg-info-strong",
  rain_delay: "bg-neutral-strong",
  lightning_hold: "bg-warning-strong",
};

/**
 * Staff controls for one facility: one-tap status presets plus a note. Shared by
 * the Today strip's pop-over/bottom-sheet editor and the /manage/conditions
 * console. Changes are applied optimistically via `onOptimistic`; realtime then
 * reconciles with the authoritative row.
 */
export function ConditionEditor({
  row,
  onOptimistic,
  showLinks = false,
  autoFocus = false,
}: {
  row: FacilityStatus;
  onOptimistic: (next: FacilityStatus) => void;
  showLinks?: boolean;
  autoFocus?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(row.message ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  // Keep the note input in sync with realtime updates to row.message — unless
  // this staffer is actively editing it — so a remote clear/change isn't
  // resurrected by a stale local draft.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(row.message ?? "");
    }
  }, [row.message]);

  useEffect(() => {
    if (autoFocus) firstRef.current?.focus();
  }, [autoFocus]);

  // A client timestamp is fine for the optimistic gap.
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
    <div className={cn("space-y-3", isPending && "opacity-70")}>
      <div className="flex flex-wrap gap-2">
        {FACILITY_PRESETS.map((preset, i) => {
          const active = row.status === preset.status;
          return (
            <button
              key={preset.status}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              disabled={isPending}
              aria-pressed={active}
              onClick={() => applyStatus(preset.status)}
              className={cn(
                "btn btn-sm gap-2",
                active ? "btn-primary" : "btn-outline",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  active && preset.status === "open"
                    ? "bg-gold-soft"
                    : STATUS_DOT[preset.status],
                )}
              />
              {preset.label}
            </button>
          );
        })}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveMessage();
        }}
      >
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
          type="submit"
          disabled={isPending}
          className="btn btn-outline btn-sm shrink-0"
        >
          Save
        </button>
      </form>
      {showLinks && (
        <div className="flex justify-between text-sm text-gold-ink">
          <Link href="/manage/conditions" className="hover:text-foreground">
            Edit detail rows →
          </Link>
          <Link
            href={`/facility/${row.facility}`}
            className="hover:text-foreground"
          >
            View page →
          </Link>
        </div>
      )}
    </div>
  );
}
