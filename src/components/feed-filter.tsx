"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { DEPARTMENTS } from "@/lib/constants";
import type { DepartmentType } from "@/lib/database.types";

/**
 * Sticky, horizontally-scrollable category chips. Multi-select: tap several to
 * combine (e.g. Golf + Dining); "All" clears the filter. Selection lives in the
 * URL (`?dept=golf,dining`) so it survives refresh and is server-rendered.
 */
export function FeedFilter({ active }: { active: DepartmentType[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSet = new Set(active);

  function navigate(depts: DepartmentType[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (depts.length) params.set("dept", depts.join(","));
    else params.delete("dept");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggle(d: DepartmentType) {
    const next = new Set(activeSet);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    navigate([...next]);
  }

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/85 px-4 py-2 backdrop-blur">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={active.length === 0} onClick={() => navigate([])}>
          All
        </Chip>
        {DEPARTMENTS.map((d) => (
          <Chip
            key={d.value}
            active={activeSet.has(d.value)}
            onClick={() => toggle(d.value)}
          >
            {d.label}
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
        // min-h-11 keeps the tap target >=44px on phones; sm:min-h-0 returns it
        // to the compact chip height on desktop.
        "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors sm:min-h-0",
        active
          ? "border-primary bg-primary text-white"
          : "border-border bg-surface text-muted hover:border-primary hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}
