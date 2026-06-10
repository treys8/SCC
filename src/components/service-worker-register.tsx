"use client";

import { useEffect } from "react";

/**
 * Registers the Web Push service worker (/sw.js, root scope) once on mount.
 * Renders nothing; mounted high in the app layout so the worker is active by
 * the time a member reaches the push toggle. Registration is idempotent — the
 * browser no-ops if the same worker is already installed.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
