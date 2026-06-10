/**
 * Browser-side Web Push helpers. Imported only by client components — every
 * function touches `window`/`navigator` lazily (inside the call), so importing
 * the module on the server is harmless.
 */

export type PushState = "subscribed" | "default" | "denied" | "unsupported";

/** Web Push needs a service worker, the Push API, and the Notification API. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Running as an installed PWA (iOS uses the legacy `navigator.standalone`). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

/** Roughly: an iOS/iPadOS device. Used to gate the install hint. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as a Mac but exposes touch points.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/**
 * VAPID public keys are base64url; PushManager wants a BufferSource. Build on a
 * concrete ArrayBuffer so the result is a plain `Uint8Array<ArrayBuffer>` (a
 * bare `Uint8Array` widens to `ArrayBufferLike`, which TS won't accept as an
 * `applicationServerKey`).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Current state, so the toggle can render the right control on mount. */
export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "subscribed" : "default";
}

/**
 * Ask permission, subscribe via the VAPID key, and persist the subscription.
 * Returns the resulting state so the caller can reflect denial/unsupported
 * without throwing for those expected outcomes.
 */
export async function enablePush(vapidPublicKey: string): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (!vapidPublicKey) throw new Error("Push is not configured.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      userAgent: navigator.userAgent,
    }),
  });
  if (!res.ok) throw new Error("Could not save your subscription.");

  return "subscribed";
}

/** Remove the server row and tear down the browser subscription. */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}
