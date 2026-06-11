import type { FacilityType } from "@/lib/database.types";

/**
 * Inline facility glyphs — golf flag, driving-range target, pool waves, tennis
 * ball — in the hand-rolled inline-SVG style used throughout the app (there's no
 * icon library in the repo). Decorative (the label carries the meaning), so
 * they're `aria-hidden`. Used by the compact conditions card and the member
 * facility detail page.
 */
export function FacilityIcon({
  facility,
  className = "h-5 w-5",
}: {
  facility: FacilityType;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPHS[facility]}
    </svg>
  );
}

const GLYPHS: Record<FacilityType, React.ReactNode> = {
  golf: (
    <>
      <path d="M7 21V3.5" />
      <path d="M7 4l9 2.4L7 8.8" />
    </>
  ),
  driving_range: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  pool: (
    <>
      <path d="M3 14q2.25 -2 4.5 0t4.5 0 4.5 0 4.5 0" />
      <path d="M3 18q2.25 -2 4.5 0t4.5 0 4.5 0 4.5 0" />
    </>
  ),
  tennis: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 5.8c4 3 4 9.4 0 12.4" />
      <path d="M18 5.8c-4 3-4 9.4 0 12.4" />
    </>
  ),
};
