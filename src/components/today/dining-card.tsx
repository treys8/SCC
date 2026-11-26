import Link from "next/link";

export type DiningDetail = { label: string; value: string };

/**
 * One dining service — the shared shell behind the lunch buffet, Fri/Sat
 * dinner, Sunday brunch and dated special/closed services.
 *
 *   variant="feature" (Today): set like a printed menu — a gold eyebrow, the
 *     dish (or service) name in large serif, sides in italic, and a ruled list
 *     of Serving / Where / Price / Reservations on the right (stacked on phones).
 *   variant="compact" (default; /dining "Coming up"): a quiet hairline-bordered
 *     row with the same information in one block.
 *
 * `mainDish`/`sides` are the chef's structured plan (lunch only); `description`
 * is the free-text blurb. `details` feeds the ruled list (feature); when it's
 * absent the joined `meta` line is shown instead. `reservation` drives:
 *   "walk_in"  → Walk-ins welcome
 *   "required" → Reservations required + a Reserve button
 *   null       → nothing
 */
export function DiningCard({
  eyebrow,
  title,
  meta = null,
  details = [],
  description = null,
  mainDish = null,
  sides = [],
  reservation = null,
  variant = "compact",
}: {
  eyebrow: string;
  title: string;
  meta?: string | null;
  details?: DiningDetail[];
  description?: string | null;
  mainDish?: string | null;
  sides?: string[];
  reservation?: "walk_in" | "required" | null;
  variant?: "compact" | "feature";
}) {
  if (variant === "feature") {
    // With a chef's dish, the dish is the headline and the service name moves
    // up into the eyebrow ("TODAY'S BUFFET · LUNCH BUFFET").
    const headline = mainDish ?? title;
    const kicker = mainDish ? `${eyebrow} · ${title}` : eyebrow;
    const rows: DiningDetail[] = [...details];
    if (reservation === "walk_in") {
      rows.push({ label: "Reservations", value: "Walk-ins welcome" });
    } else if (reservation === "required") {
      rows.push({ label: "Reservations", value: "Required" });
    }
    const hasAside = rows.length > 0 || reservation === "required";

    return (
      <section
        className={
          hasAside
            ? "grid gap-8 md:grid-cols-[1.35fr_1fr] md:gap-14 lg:gap-20"
            : undefined
        }
      >
        <div className="min-w-0">
          <p className="eyebrow">{kicker}</p>
          <h2 className="text-hero mt-4 text-foreground">{headline}</h2>
          {sides.length > 0 && (
            <p className="mt-4 font-serif text-xl leading-snug text-muted italic sm:text-[1.35rem]">
              with {joinSides(sides)}
            </p>
          )}
          {description && (
            <p className="mt-5 max-w-[30rem] text-[0.95rem] leading-relaxed text-muted">
              {description}
            </p>
          )}
          {rows.length === 0 && meta && (
            <p className="mt-4 text-sm text-muted">{meta}</p>
          )}
        </div>
        {hasAside && (
          <div className="self-end">
            {rows.length > 0 && (
              <dl className="border-t border-foreground/70">
                {rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4 border-b border-border py-3.5 text-[0.92rem]"
                  >
                    <dt className="tracking-[0.03em] text-muted">{row.label}</dt>
                    <dd
                      className={
                        row.label === "Reservations" && reservation === "walk_in"
                          ? "text-right font-medium text-primary"
                          : "text-right font-medium text-foreground"
                      }
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {reservation === "required" && (
              <Link href="/reservations" className="btn btn-primary mt-5 w-full">
                Reserve a table
              </Link>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="flex gap-4 rounded-lg border border-border/80 bg-surface p-4 sm:p-5">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/40 text-gold-ink"
        aria-hidden
      >
        <UtensilsGlyph />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-[0.66rem]">{eyebrow}</p>
        <h3 className="mt-2 text-h2 text-foreground">{title}</h3>
        {meta && <p className="mt-1 text-sm text-muted">{meta}</p>}
        {mainDish && (
          <p className="mt-2 font-serif text-[1.05rem] text-foreground">
            {mainDish}
          </p>
        )}
        {sides.length > 0 && (
          <p className="mt-0.5 font-serif text-sm text-muted italic">
            with {joinSides(sides)}
          </p>
        )}
        {description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{description}</p>
        )}
        {reservation === "walk_in" && (
          <p className="mt-2 text-sm font-medium text-primary">
            Walk-ins welcome
          </p>
        )}
        {reservation === "required" && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-medium text-foreground">
              Reservations required
            </span>
            <Link href="/reservations" className="btn btn-primary btn-sm">
              Reserve a table
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** "a", "a & b", "a, b & c" — reads like a menu line. */
function joinSides(sides: string[]): string {
  if (sides.length <= 1) return sides.join("");
  return `${sides.slice(0, -1).join(", ")} & ${sides.at(-1)}`;
}

/** A fork-and-knife glyph (inline SVG, matching house style). */
function UtensilsGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}
