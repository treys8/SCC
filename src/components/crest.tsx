export function Crest({ className }: { className?: string }) {
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
        fill="var(--primary)"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      <text
        x="24"
        y="29"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="15"
        fontWeight="700"
        letterSpacing="0.5"
        fill="var(--accent)"
      >
        SCC
      </text>
    </svg>
  );
}
