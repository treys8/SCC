/**
 * Small URL guards shared across the app.
 *
 * Server-safe (no browser/Node-only APIs) so it can be imported from Server
 * Actions, Route Handlers, and Client Components alike.
 */

// CR/LF/tab and other control chars can smuggle a host past naive parsers.
// Built from a string so no literal control bytes live in this source file.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]");

/**
 * Return `raw` only when it is a safe same-origin path, otherwise `fallback`.
 *
 * A bare `raw.startsWith("/")` check is NOT enough: `//evil.com` and
 * `/\evil.com` both start with "/" yet resolve cross-origin once handed to the
 * browser or `new URL(path, origin)`, giving an open-redirect / phishing
 * primitive. We reject the protocol-relative and backslash forms, anything that
 * isn't a single leading slash, and embedded control characters.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  if (CONTROL_CHARS.test(raw)) return fallback;
  return raw;
}

/**
 * Hostnames we accept a Web Push endpoint for. A push endpoint is a bearer URL
 * the browser hands us; pinning it to the real push services stops a crafted
 * `endpoint` from turning our send loop into an outbound SSRF and bounds what
 * can be stored against a member.
 */
const PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com", // Chrome / Android
  "push.apple.com", // Safari / iOS (web.push.apple.com)
  "notify.windows.com", // Edge / Windows (*.notify.windows.com)
  "push.services.mozilla.com", // Firefox (updates.push.services.mozilla.com)
];

/** True when `endpoint` is an https URL on a known push-service host. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/**
 * Accept a Storage URL only when it points at this project's public `posts`
 * bucket — the one origin next/image is configured to optimize and the only
 * place our uploaders write. A client-controlled value pointing anywhere else
 * (off-origin link, `javascript:` / `data:`, an attacker's host) is rejected so
 * it can't be persisted and rendered into an `<a href>`/`<img src>`.
 *
 * Returns the URL if valid, else null. When the Supabase host env is missing we
 * can't verify, so we trust the value (same posture as the event-cover check).
 */
export function postsPublicUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return trimmed;
  const prefix = `${base}/storage/v1/object/public/posts/`;
  return trimmed.startsWith(prefix) ? trimmed : null;
}

/**
 * Re-derive the canonical public URL for an object from its storage path. Used
 * to recover a safe URL when a client-supplied attachment `url` fails the
 * `postsPublicUrl` prefix check — the path always stays inside our bucket.
 * Returns null when the Supabase host env is unavailable.
 */
export function postsObjectUrl(storagePath: string | null | undefined): string | null {
  const path = (storagePath ?? "").trim().replace(/^\/+/, "");
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/posts/${path}`;
}

/**
 * The in-bucket path behind a public posts URL — the inverse of
 * `postsObjectUrl`. Used when an object already in the bucket (a golf-log photo)
 * is attached to a post, since `post_attachments.storage_path` is required and
 * there's no upload to take it from. Returns null for anything that isn't one of
 * our posts-bucket URLs, so a foreign link can never be recorded as a path.
 */
export function postsStoragePathFromUrl(
  raw: string | null | undefined,
): string | null {
  const url = postsPublicUrl(raw);
  if (!url) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  const prefix = `${base}/storage/v1/object/public/posts/`;
  // Drop any ?query the URL carries; a storage path has none.
  const path = url.slice(prefix.length).split("?")[0];
  return path || null;
}

/** Same-origin guard as `postsPublicUrl`, for the `documents` bucket. */
export function documentsPublicUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return trimmed;
  const prefix = `${base}/storage/v1/object/public/documents/`;
  return trimmed.startsWith(prefix) ? trimmed : null;
}

/** Re-derive a canonical `documents` object URL from its storage path. */
export function documentsObjectUrl(storagePath: string | null | undefined): string | null {
  const path = (storagePath ?? "").trim().replace(/^\/+/, "");
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/documents/${path}`;
}
