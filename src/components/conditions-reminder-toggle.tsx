"use client";

import { useState, useTransition } from "react";
import { setConditionsReminderEnabled } from "@/app/(app)/facility/actions";
import { cn } from "@/lib/cn";

/**
 * Club-wide toggle for the morning "refresh conditions" reminder. Optimistic:
 * flips the checkbox immediately and reverts if the save fails. Staff turn this
 * off once updating conditions each morning is part of the routine.
 */
export function ConditionsReminderToggle({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    setEnabled(next);
    startTransition(async () => {
      try {
        await setConditionsReminderEnabled(next);
      } catch (e) {
        console.error("conditions reminder toggle failed:", e);
        setEnabled(!next);
      }
    });
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h2 text-foreground">Morning reminder</h2>
        <p className="mt-1 text-sm text-muted">
          Sends staff a reminder each morning when conditions haven&apos;t been
          refreshed in a day. Turn it off once updating them is part of the
          routine.
        </p>
      </div>
      <div className={cn("card p-5 sm:p-6", isPending && "opacity-70")}>
        <label className="flex items-center gap-3 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            disabled={isPending}
            onChange={(e) => toggle(e.target.checked)}
          />
          Send a morning reminder to refresh conditions
        </label>
      </div>
    </section>
  );
}
