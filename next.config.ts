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
};

export default nextConfig;
