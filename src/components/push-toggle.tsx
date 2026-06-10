"use client";

import { useEffect, useState } from "react";
import {
  disablePush,
  enablePush,
  getPushState,
  isIos,
  isStandalone,
  type PushState,
} from "@/lib/push-client";

const BLOCKED_HINT =
  "Notifications are blocked. Enable them for this site in your browser settings, then try again.";

/**
 * Member control to turn Web Push on or off, shown on the profile page beside
 * the department preferences. Browser-only state (permission, existing
 * subscription, iOS/standalone) is read after mount to avoid hydration
 * mismatch. On iOS in a normal tab push isn't available, so we show the
 * Add-to-Home-Screen hint instead of a dead toggle.
 */
export function PushToggle() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const [state, setState] = useState<PushState | null>(null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextIos = isIos();
      const nextStandalone = isStandalone();
      let nextState: PushState;
      try {
        nextState = await getPushState();
      } catch {
        nextState = "unsupported";
      }
      if (cancelled) return;
      setIos(nextIos);
      setStandalone(nextStandalone);
      setState(nextState);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    try {
      const result = await enablePush(vapidKey);
      setState(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError(null);
    try {
      await disablePush();
      setState("default");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-6">
      <div>
        <h2 className="text-lg font-semibold">Push notifications</h2>
        <p className="field-hint">
          Get alerts on this device for facility status changes and updates to
          your reservations — even when the app is closed.
        </p>
      </div>

      {renderBody()}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );

  function renderBody() {
    if (state === null) {
      return <p className="text-sm text-muted">Checking…</p>;
    }

    // iOS only delivers Web Push to a home-screen-installed PWA (iOS 16.4+).
    if (ios && !standalone) {
      return (
        <p className="text-sm text-muted">
          To get alerts on your iPhone or iPad, add SCC to your Home Screen:
          tap the Share button, then{" "}
          <span className="font-medium">Add to Home Screen</span>. Open it from
          there and you can turn on notifications.
        </p>
      );
    }

    if (state === "unsupported") {
      return (
        <p className="text-sm text-muted">
          This browser doesn’t support push notifications.
        </p>
      );
    }

    if (state === "denied") {
      return <p className="text-sm text-muted">{BLOCKED_HINT}</p>;
    }

    if (state === "subscribed") {
      return (
        <button
          type="button"
          onClick={handleDisable}
          disabled={busy}
          className="btn btn-outline"
        >
          {busy ? "Turning off…" : "Turn off notifications"}
        </button>
      );
    }

    // "default" — the member can enable (browser will prompt for permission).
    return (
      <button
        type="button"
        onClick={handleEnable}
        disabled={busy}
        className="btn btn-primary"
      >
        {busy ? "Turning on…" : "Turn on notifications"}
      </button>
    );
  }
}
