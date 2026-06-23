"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Result-type scopes for the member search page. "all" clears the `type` param. */
export const SEARCH_TYPES = [
  { value: "all", label: "All" },
  { value: "posts", label: "Feed" },
  { value: "docs", label: "Documents" },
  { value: "events", label: "Events" },
] as const;

export type SearchType = (typeof SEARCH_TYPES)[number]["value"];

/**
 * Member search controls: a debounced keyword box + result-type chips. Both
 * write to the URL (`?q=&type=`) so the server page re-renders the results —
 * the same URL-driven pattern as the staff post search and the feed filter.
 * `counts` (when a query is active) labels each tab with its per-group result
 * count; the server formats them as strings (e.g. "10+" when posts has more).
 */
export function MemberSearch({
  q,
  type,
  counts,
}: {
  q: string;
  type: SearchType;
  counts: Record<SearchType, string> | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local keyword state keeps typing responsive; pushed to the URL on a debounce.
  const [keyword, setKeyword] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync when `q` changes from outside (back/forward nav) — adjust-during-render.
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

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon />
        <input
          type="search"
          value={keyword}
          onChange={(e) => onKeyword(e.target.value)}
          placeholder="Search the feed, documents, and events…"
          aria-label="Search"
          autoFocus
          className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {SEARCH_TYPES.map((t) => (
          <Chip
            key={t.value}
            active={type === t.value}
            onClick={() => setParam("type", t.value === "all" ? "" : t.value)}
          >
            {t.label}
            {counts && (
              <span
                className={cn(
                  "ml-1.5 text-xs tabular-nums",
                  type === t.value ? "text-white/80" : "text-muted",
                )}
              >
                {counts[t.value]}
              </span>
            )}
          </Chip>
        ))}
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
