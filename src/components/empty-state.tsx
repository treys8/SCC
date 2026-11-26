import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    // No box: a quiet, centred italic line between two hairlines — the
    // editorial way of saying "nothing here yet".
    <div className="flex flex-col items-center justify-center gap-2 border-y border-border px-6 py-14 text-center">
      {icon && (
        <div
          aria-hidden
          className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 text-gold-ink"
        >
          {icon}
        </div>
      )}
      <p className="font-serif text-2xl text-foreground italic">{title}</p>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
