// SCC member portal — Web Push service worker.
//
// Plain JS, no build step (served verbatim from /public at /sw.js, root scope).
// Bump SW_VERSION when editing so clients pick up the new worker promptly; the
// /sw.js response is sent with no-cache (see next.config.ts) to the same end.
const SW_VERSION = "1";

// Activate a new worker immediately rather than waiting for all tabs to close.
self.addEventListener("install", () => {
  console.info("SCC service worker v" + SW_VERSION + " installing");
  self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

// A push arrived — show the notification the server sent.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Starkville Country Club";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon.svg",
    badge: "/icon.svg",
    // A stable tag (e.g. "facility-golf") collapses repeats in the OS tray.
    tag: payload.tag,
    // Where notificationclick should take the member.
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// The member tapped a notification — focus an open tab or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        // Reuse an existing window: navigate it to the target, then focus.
        if ("focus" in client) {
          try {
            if ("navigate" in client) await client.navigate(url);
          } catch {
            // Uncontrolled or cross-origin client — just focus it.
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
