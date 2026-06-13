"use client";

import { useRouter } from "next/navigation";

/**
 * Date stepper above the nightly chart: jump a day at a time or pick a date, and
 * print the night's list. Preserves the queue's status filter so moving the chart
 * date doesn't reset the working queue below it. Navigation is plain URL changes
 * (the chart is server-rendered from `?date=`).
 */
const pad = (n: number) => String(n).padStart(2, "0");

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function ChartDateNav({
  date,
  status,
}: {
  date: string;
  status: string | null;
}) {
  const router = useRouter();

  function urlFor(next: string): string {
    const params = new URLSearchParams();
    params.set("date", next);
    if (status) params.set("status", status);
    return `/reservations?${params.toString()}`;
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => router.push(urlFor(addDays(date, -1)))}
        className="btn btn-ghost btn-sm"
      >
        ‹
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => {
          if (e.target.value) router.push(urlFor(e.target.value));
        }}
        className="input w-auto"
        aria-label="Chart date"
      />
      <button
        type="button"
        aria-label="Next day"
        onClick={() => router.push(urlFor(addDays(date, 1)))}
        className="btn btn-ghost btn-sm"
      >
        ›
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="btn btn-ghost btn-sm text-muted"
      >
        Print
      </button>
    </div>
  );
}
