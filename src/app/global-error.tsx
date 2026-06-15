"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown by the root layout / app-layout itself
 * (above the per-segment (app)/error.tsx). It replaces the root layout, so it
 * must render its own <html>/<body> and cannot rely on the global stylesheet —
 * hence the inline styles, kept on-brand with the club palette (globals.css).
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Root render error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f3ea",
          color: "#1c2620",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#5b6660", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
            The member portal hit an unexpected error. Please try again — if it
            keeps happening, contact the club.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              background: "#335d3b",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
