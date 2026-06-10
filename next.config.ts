import type { NextConfig } from "next";

// Derive the Storage host from the configured Supabase URL so image
// optimization keeps working across projects (preview/staging/prod) without a
// hardcoded ref. Falls back to the known production host if the env is absent.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
  } catch {
    return "fluhpbandhruuqlojlfz.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  images: {
    // Only optimize files served from the public `posts` Storage bucket.
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/posts/**",
      },
    ],
  },
  // The Web Push service worker is served from /public. Override the default
  // `public, max-age=0` so browsers never run a stale worker, set the JS
  // content type explicitly, and allow root scope.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
