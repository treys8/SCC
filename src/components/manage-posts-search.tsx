"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DEPARTMENTS } from "@/lib/constants";
import type { DepartmentType, PostStatus } from "@/lib/database.types";

const STATUS_TABS: { value: PostStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Drafts" },
];

/**
 * Staff post-search controls: a debounced keyword box, multi-select department
 * chips, and a created_at date range. Every control writes to the URL
 * (`?q=&dept=golf,dining&from=&to=`) so the server page re-renders the results
 * — same pattern as the member feed's FeedFilter, just with more inputs.
 */
export function ManagePostsSearch({
  q,
  depts,
  from,
  to,
  status,
}: {
  q: string;
  depts: DepartmentType[];
  from: string;
  to: string;
  status: PostStatus | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSet = new Set(depts);

  // Local keyword state keeps typing responsive; it's pushed to the URL on a
  // debounce so we don't navigate on every keystroke.
  const [keyword, setKeyword] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync the input when the URL `q` changes from outside (Clear, back/forward
  // nav) — the "adjust state during render" pattern rather than an effect. The
  // debounce coalesces keystrokes, so `q` only ever becomes the final typed
  // value and this never fights live typing.
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setKeyword(q);
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onKeyword(value: string) {
    setKeyword(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam("q", value.trim()), 300);
  }

  function toggleDept(d: DepartmentType) {
    const next = new Set(activeSet);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setParam("dept", [...next].join(","));
  }

  function clearAll() {
    if (timer.current) clearTimeout(timer.current);
    setKeyword("");
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = !!(keyword || depts.length || from || to || status);

  return (
    <div className="card space-y-3 p-4">
      <div className="relative">
        <SearchIcon />
        <input
          type="search"
          value={keyword}
          onChange={(e) => onKeyword(e.target.value)}
          placeholder="Search titles and text…"
          aria-label="Search posts"
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </div>

      <div
        role="tablist"
        aria-label="Filter by status"
        className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1"
      >
        {STATUS_TABS.map((t) => {
          const active = (status ?? "") === t.value;
          return (
            <button
              key={t.value || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParam("status", t.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                active
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={depts.length === 0} onClick={() => setParam("dept", "")}>
          All
        </Chip>
        {DEPARTMENTS.map((d) => (
          <Chip
            key={d.value}
            active={activeSet.has(d.value)}
            onClick={() => toggleDept(d.value)}
          >
            {d.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <label className="flex items-center gap-1.5">
          <span>From</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setParam("from", e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-foreground focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span>To</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setParam("to", e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-foreground focus:border-primary focus:outline-none"
          />
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition active:scale-[0.98]",
        active
          ? "border-primary bg-primary font-semibold text-white shadow-sm"
          : "border-border bg-surface text-foreground/70 hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
