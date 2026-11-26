"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ConditionEditor } from "@/components/condition-editor";
import { cn } from "@/lib/cn";
import {
  FACILITY_LABEL,
  FACILITY_STATUS_LABEL,
  URGENT_FACILITY_STATUSES,
} from "@/lib/constants";
import { isConditionsStale } from "@/lib/facility";
import { conditionsSince, conditionsStamp, formatTimestamp } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { useLiveFacilityStatus } from "@/lib/use-live-facility-status";
import type {
  FacilityStatus,
  FacilityStatusType,
  FacilityType,
} from "@/lib/database.types";

/**
 * "Conditions" — the strip directly under the Today hero, for members AND staff.
 * A column per facility (4 across on desktop, 2×2 on phones) with the status in
 * serif beside a coloured dot, a per-column "updated" stamp, and the facility's
 * note + detail rows.
 *
 * - Urgent weather states (frost / rain / lightning) tint the column, add an
 *   accent bar and a pulsing dot, and say "since …". Closed stays static.
 * - A realtime change flashes that column gold (useLiveFacilityStatus).
 * - Open: note + up to three detail rows (desktop) / note or one rotating
 *   detail line (phones). Not open: "since" + note only — detail rows describe
 *   normal operation and would contradict the status.
 * - Members: each column links to /facility/[type]. Staff: a column opens the
 *   ConditionEditor (pop-over on desktop, bottom sheet on phones), and stale
 *   columns carry a "Needs refresh" marker.
 *
 * Clock-dependent text (stamps, "since", stale) renders only after hydration so
 * the server HTML and the first client render agree.
 */
export function ConditionsGrid({
  facilities,
  canManage = false,
}: {
  facilities: FacilityStatus[];
  canManage?: boolean;
}) {
  // Bumped per pushed change; the count keys a one-shot glow overlay.
  const [glow, setGlow] = useState<Partial<Record<FacilityType, number>>>({});
  const [rows, mergeRow] = useLiveFacilityStatus(facilities, (f) =>
    setGlow((g) => ({ ...g, [f]: (g[f] ?? 0) + 1 })),
  );
  const hydrated = useHydrated();
  const now = useNow(30_000);
  const [editing, setEditing] = useState<FacilityType | null>(null);
  const [focusWithin, setFocusWithin] = useState(false);
  const tick = useRotationTick(focusWithin || editing !== null);

  const closeEditor = useCallback(() => {
    if (editing) document.getElementById(`condition-${editing}`)?.focus();
    setEditing(null);
  }, [editing]);

  // Escape closes the editor and returns focus to the column that opened it.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEditor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, closeEditor]);

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="conditions-heading">
      <h2 id="conditions-heading" className="sr-only">
        Conditions
      </h2>
      {/* gap-px over a hairline-coloured background draws the dividers, so the
          same markup gives 4 columns (lg) or a 2×2 grid. */}
      <div
        className="grid grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4"
        onFocus={() => setFocusWithin(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setFocusWithin(false);
          }
        }}
      >
        {rows.map((f, i) => (
          <ConditionCell
            key={f.facility}
            facility={f}
            index={i}
            canManage={canManage}
            hydrated={hydrated}
            now={now}
            tick={tick}
            glowCount={glow[f.facility] ?? 0}
            editing={editing === f.facility}
            onOpen={() => setEditing(f.facility)}
            onClose={closeEditor}
            onOptimistic={mergeRow}
          />
        ))}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3 text-caption tracking-[0.04em] text-muted">
        <span className="font-semibold tracking-[0.16em] uppercase">
          Conditions
        </span>
        {canManage && (
          <Link
            href="/manage/conditions"
            className="text-gold-ink hover:text-foreground"
          >
            Manage conditions →
          </Link>
        )}
      </div>
    </section>
  );
}

// ── Tones ──────────────────────────────────────────────────────────────────

/** Status text/dot colour, from the same palette as FacilityStatusBadge. */
const STATUS_TONE: Record<FacilityStatusType, string> = {
  open: "text-primary",
  closed: "text-danger",
  frost_delay: "text-info-strong",
  rain_delay: "text-neutral-strong",
  lightning_hold: "text-warning-strong",
};

/** Column tint for the urgent states only. */
const URGENT_TINT: Partial<Record<FacilityStatusType, string>> = {
  frost_delay: "bg-info-soft",
  rain_delay: "bg-neutral-soft",
  lightning_hold: "bg-warning-soft",
};

/** Shorter status words for the narrow phone columns. */
const SHORT_STATUS: Partial<Record<FacilityStatusType, string>> = {
  lightning_hold: "Lightning",
};

// ── Cell ───────────────────────────────────────────────────────────────────

function ConditionCell({
  facility: f,
  index,
  canManage,
  hydrated,
  now,
  tick,
  glowCount,
  editing,
  onOpen,
  onClose,
  onOptimistic,
}: {
  facility: FacilityStatus;
  index: number;
  canManage: boolean;
  hydrated: boolean;
  now: Date;
  tick: number;
  glowCount: number;
  editing: boolean;
  onOpen: () => void;
  onClose: () => void;
  onOptimistic: (next: FacilityStatus) => void;
}) {
  const urgent = URGENT_FACILITY_STATUSES.has(f.status);
  const label = FACILITY_LABEL[f.facility];

  // Tint + tone live on the outer box so the accent bar can use currentColor.
  const outer = cn(
    "group relative",
    urgent
      ? cn(URGENT_TINT[f.status], STATUS_TONE[f.status])
      : "bg-background transition-colors hover:bg-surface-2",
    editing && "bg-surface-2",
  );
  // The first column sits flush with the page gutter (as before) — unless it's
  // tinted, when it needs the padding to read as a block. Members' Link is the
  // grid child itself (odd:/first:); staff's button sits inside the grid child
  // (group-odd:/group-first:).
  const pad = cn(
    "h-full px-4 py-5 text-left sm:px-6 sm:py-7",
    !urgent &&
      (canManage
        ? "max-lg:group-odd:pl-0 lg:group-first:pl-0"
        : "max-lg:odd:pl-0 lg:first:pl-0"),
  );

  const body = (
    <CellBody
      facility={f}
      urgent={urgent}
      canManage={canManage}
      hydrated={hydrated}
      now={now}
      tick={tick}
    />
  );

  const overlays: ReactNode = (
    <>
      {urgent && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] bg-current"
        />
      )}
      {glowCount > 0 && (
        <span
          key={glowCount}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gold-soft/45 opacity-0 animate-[cond-glow_2.4s_ease-out]"
        />
      )}
    </>
  );

  if (!canManage) {
    return (
      <Link href={`/facility/${f.facility}`} className={cn(outer, pad, "block")}>
        {overlays}
        {body}
      </Link>
    );
  }

  return (
    <div className={outer}>
      {overlays}
      <button
        id={`condition-${f.facility}`}
        type="button"
        onClick={editing ? onClose : onOpen}
        aria-expanded={editing}
        aria-haspopup="dialog"
        aria-label={`${label}: ${FACILITY_STATUS_LABEL[f.status]}. Update`}
        // flex-col: buttons centre content vertically; stack from the top instead.
        className={cn(pad, "flex w-full cursor-pointer flex-col justify-start")}
      >
        {body}
      </button>
      {editing && (
        <>
          {/* Scrim: dims the page on phones; invisible click-catcher on desktop. */}
          <div
            aria-hidden
            onClick={onClose}
            className="fixed inset-0 z-40 bg-green-darker/40 animate-[overlay-in_150ms_ease-out] motion-reduce:animate-none lg:bg-transparent"
          />
          <div
            role="dialog"
            aria-label={`Update ${label}`}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl",
              "animate-[sheet-in_200ms_ease-out] motion-reduce:animate-none",
              "lg:absolute lg:inset-x-auto lg:top-full lg:bottom-auto lg:mt-2 lg:w-[26rem] lg:rounded-2xl lg:border lg:border-border lg:pb-5 lg:animate-[overlay-in_150ms_ease-out]",
              index % 4 >= 2 ? "lg:right-0" : "lg:left-0",
            )}
          >
            <div
              aria-hidden
              className="mx-auto mb-4 h-1 w-10 rounded-full bg-border lg:hidden"
            />
            <p className="font-serif text-xl leading-tight">{label}</p>
            <p className="mt-1 mb-4 text-caption text-muted">
              {FACILITY_STATUS_LABEL[f.status]}
              {hydrated && <> · since {conditionsSince(f.updated_at, now)}</>}
              {" · "}a status change alerts members
            </p>
            <ConditionEditor
              row={f}
              onOptimistic={onOptimistic}
              showLinks
              autoFocus
            />
          </div>
        </>
      )}
    </div>
  );
}

function CellBody({
  facility: f,
  urgent,
  canManage,
  hydrated,
  now,
  tick,
}: {
  facility: FacilityStatus;
  urgent: boolean;
  canManage: boolean;
  hydrated: boolean;
  now: Date;
  tick: number;
}) {
  // A non-open column already says "since …" — don't repeat the time.
  const stamp =
    hydrated && f.status === "open" ? conditionsStamp(f.updated_at, now) : null;
  const stale = hydrated && canManage && isConditionsStale(f.updated_at);
  const statusWord = FACILITY_STATUS_LABEL[f.status];
  const short = SHORT_STATUS[f.status];

  // Detail rows describe normal operation ("Mats · Open", pool hours), so they'd
  // contradict a hold or closure — a non-open column shows "since" + the note
  // only. On phones the note, when set, is pinned; otherwise details rotate.
  const isOpen = f.status === "open";
  const details = isOpen ? f.details : [];
  const lines: ReactNode[] = f.message
    ? [<span key="note" className="italic">{f.message}</span>]
    : details.map((d) => (
        <DetailText key={d.label} label={d.label} value={d.value} urgent={urgent} />
      ));
  const rotIndex = lines.length ? tick % lines.length : 0;

  return (
    <>
      <span
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-2 text-[0.68rem] font-semibold tracking-[0.18em] uppercase",
          urgent ? "text-current opacity-85" : "text-muted",
        )}
      >
        <span className="truncate">{FACILITY_LABEL[f.facility]}</span>
        {stale ? (
          // A bare amber dot on phones (the columns are too narrow for the pill).
          <span
            title="Needs refresh"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning-soft p-1 text-[0.68rem] font-medium tracking-normal text-warning-strong normal-case sm:px-2 sm:py-0.5"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="max-sm:sr-only">Needs refresh</span>
          </span>
        ) : (
          stamp && (
            <time
              dateTime={f.updated_at}
              title={formatTimestamp(f.updated_at)}
              className={cn(
                // Phones: its own line under the name — side by side truncates
                // the name in a ~160px column.
                "shrink-0 text-[0.72rem] font-normal tracking-[0.02em] normal-case max-sm:mt-1 max-sm:basis-full",
                stamp === "Just now" && "font-semibold text-gold-ink",
              )}
            >
              {stamp}
            </time>
          )
        )}
      </span>

      <span
        className={cn(
          "mt-2.5 flex items-center gap-2.5 font-serif text-2xl leading-none sm:text-[1.7rem]",
          STATUS_TONE[f.status],
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 shrink-0 rounded-full bg-current",
            urgent
              ? "animate-[cond-pulse_1.8s_ease-out_infinite]"
              : "shadow-[0_0_0_4px_color-mix(in_oklab,currentColor_14%,transparent)]",
          )}
        />
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="max-sm:hidden">{statusWord}</span>
          </>
        ) : (
          statusWord
        )}
      </span>

      {hydrated && !isOpen && (
        <span
          className={cn(
            "mt-2 block text-[0.8rem] sm:text-[0.84rem]",
            urgent ? "font-medium" : "text-muted",
          )}
        >
          since {conditionsSince(f.updated_at, now)}
        </span>
      )}

      {/* Desktop: the note, then (open only) up to three detail rows. */}
      {f.message && (
        <span
          className={cn(
            "mt-2 line-clamp-2 text-[0.84rem] leading-snug italic max-lg:hidden",
            urgent ? "text-current" : "text-foreground",
          )}
        >
          {f.message}
        </span>
      )}
      {details.length > 0 && (
        <span className="mt-2 block space-y-0.5 max-lg:hidden">
          {details.slice(0, 3).map((d) => (
            <span key={d.label} className="block truncate text-[0.82rem] leading-snug">
              <DetailText label={d.label} value={d.value} urgent={urgent} />
            </span>
          ))}
        </span>
      )}

      {/* Phones/tablets: the pinned note, or one rotating detail line. Fixed
          two-line height so the 2×2 grid doesn't jump as lines change. */}
      {lines.length > 0 && (
        <span
          className={cn(
            "mt-2 block h-[2.6em] text-[0.8rem] leading-[1.3] lg:hidden",
            urgent ? "text-current" : "text-muted",
          )}
        >
          <span
            key={rotIndex}
            className="line-clamp-2 animate-[cond-fade_400ms_ease-out] motion-reduce:animate-none"
          >
            {lines[rotIndex]}
          </span>
        </span>
      )}
    </>
  );
}

function DetailText({
  label,
  value,
  urgent,
}: {
  label: string;
  value: string;
  urgent: boolean;
}) {
  return (
    <>
      <span className={urgent ? "opacity-80" : "text-muted"}>{label} · </span>
      <span className={cn("font-medium", urgent ? "text-current" : "text-foreground")}>
        {value}
      </span>
    </>
  );
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/** A clock that ticks every `intervalMs`, so "Just now" rolls over on its own. */
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Shared counter for the phone detail rotation (every 4s). Idle on desktop
 * (where all lines show), under reduced motion, and while paused (focus inside
 * the strip, or the editor open).
 */
function useRotationTick(paused: boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (paused) return;
    const narrow = window.matchMedia("(max-width: 1023.98px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!narrow.matches || reduce.matches) return;
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, [paused]);
  return tick;
}
