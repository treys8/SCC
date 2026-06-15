"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";

/**
 * Fallback UI for an uncaught error while rendering a page in the app shell
 * (a transient Supabase/network failure, a render bug). Replaces the page
 * content with a branded card; the nav/footer from (app)/layout stay in place.
 * `unstable_retry` re-fetches and re-renders the segment (Next 16.2+).
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Surfaces in the server logs (digest matches the server-side entry).
    console.error("App render error:", error);
  }, [error]);

  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <p className="text-h2 text-foreground">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted">
        We hit a snag loading this page. This is usually temporary — please try
        again.
      </p>
      <div className="mt-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="btn btn-primary"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
