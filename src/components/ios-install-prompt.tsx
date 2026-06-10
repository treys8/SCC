"use client";

import { useEffect, useState } from "react";
import { isIos, isStandalone } from "@/lib/push-client";

const DISMISS_KEY = "scc-ios-install-dismissed";

/**
 * Nudge iOS members to install the PWA — Web Push only works on iOS once the
 * app is on the Home Screen (iOS 16.4+). Shown only on iOS Safari when not
 * already running standalone, and only until dismissed (remembered in
 * localStorage). Renders nothing everywhere else.
 */
export function IosInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isIos() || isStandalone()) return;
      try {
        if (localStorage.getItem(DISMISS_KEY) === "1") return;
      } catch {
        // localStorage unavailable (private mode) — just show it this session.
      }
      if (cancelled) return;
      setShow(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore — worst case the banner returns next visit
    }
    setShow(false);
  }

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex-1 text-sm">
        <p className="font-medium">Get alerts on your phone</p>
        <p className="mt-1 text-muted">
          Add SCC to your Home Screen to receive course and reservation
          notifications: tap the Share button, then{" "}
          <span className="font-medium">Add to Home Screen</span>.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="btn btn-ghost btn-sm shrink-0"
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
