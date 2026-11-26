import { cn } from "@/lib/cn";

/** Compact month/day badge, e.g. "JUN / 7". */
export function DateChip({
  dateStr,
  className,
}: {
  dateStr: string;
  className?: string;
}) {
  const [, m, d] = dateStr.split("-").map(Number);
  const month = new Date(2000, m - 1, 1)
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  return (
    <div
      className={cn(
        "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-green-deep text-cream",
        className,
      )}
    >
      <span className="text-2xs font-semibold tracking-[0.14em] text-gold-soft">
        {month}
      </span>
      <span className="mt-0.5 font-serif text-2xl leading-none">{d}</span>
    </div>
  );
}
