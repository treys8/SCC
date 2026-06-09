import type { MetadataRoute } from "next";

// Web App Manifest — makes the portal installable as a standalone app (no
// browser chrome) on Android/Chrome. iOS uses app/apple-icon.tsx for its
// home-screen icon. Colors sampled from the SCC palette (globals.css).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Starkville Country Club",
    short_name: "SCC",
    description:
      "Member portal for Starkville Country Club — announcements, dining reservations, and the club calendar.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ea",
    theme_color: "#335d3b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
