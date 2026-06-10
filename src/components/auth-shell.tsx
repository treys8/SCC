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
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Crest className="h-14 w-14" />
          <p className="mt-3 text-h2 text-primary">Starkville Country Club</p>
          {title && (
            <h1 className="mt-5 text-h1 text-foreground">{title}</h1>
          )}
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
