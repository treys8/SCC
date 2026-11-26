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
          background: "#1d3523",
          color: "#f3eee2",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontWeight: 400,
              fontSize: "2rem",
              margin: "0 0 0.75rem",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ color: "rgba(243, 238, 226, 0.72)", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
            The member portal hit an unexpected error. Please try again — if it
            keeps happening, contact the club.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              background: "#d9c29a",
              color: "#152a1b",
              border: "none",
              borderRadius: "9999px",
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
