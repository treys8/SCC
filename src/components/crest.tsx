/**
 * The SCC roundel. `tone="light"` (default) is the filled green coin used on
 * parchment; `tone="dark"` drops the fill so it sits on the green header band
 * as a gold ring with gold letters.
 */
export function Crest({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Starkville Country Club crest"
    >
      <circle
        cx="24"
        cy="24"
        r="22"
        fill={dark ? "transparent" : "var(--primary)"}
        stroke={dark ? "var(--gold-soft)" : "var(--accent)"}
        strokeWidth={dark ? "1.25" : "2"}
      />
      <text
        x="24"
        y="29"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="15"
        fontWeight={dark ? "400" : "700"}
        letterSpacing={dark ? "1" : "0.5"}
        fill={dark ? "var(--gold-soft)" : "var(--accent)"}
      >
        SCC
      </text>
    </svg>
  );
}
