import type { ReactNode } from "react";
import { Crest } from "@/components/crest";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    // The front door: the same deep green as the member header band, with a
    // soft vignette, so signing in already feels like the club.
    <div className="on-dark flex min-h-screen items-center justify-center bg-green-deep bg-[radial-gradient(ellipse_at_top,rgba(217,194,154,0.12),transparent_60%)] px-4 py-12 text-cream">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Crest tone="dark" className="h-16 w-16" />
          <p className="mt-4 font-serif text-2xl tracking-[0.01em] text-cream">
            Starkville Country Club
          </p>
          <span aria-hidden className="mt-4 h-px w-16 bg-accent/60" />
          {title && <h1 className="mt-6 text-h1 text-cream">{title}</h1>}
          {subtitle && (
            <p className="mt-2 text-sm text-cream/70">{subtitle}</p>
          )}
        </div>
        <div className="rounded-xl bg-surface p-6 text-foreground shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)] sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
