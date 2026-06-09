import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Starkville Country Club",
    template: "%s · Starkville Country Club",
  },
  description:
    "Member portal for Starkville Country Club — announcements, dining reservations, and the club calendar.",
  // Launch standalone (no Safari chrome) when added to an iOS home screen.
  // `appleWebApp` emits the modern `mobile-web-app-capable`; `other` adds the
  // legacy `apple-mobile-web-app-capable` that iOS < 17 still needs.
  appleWebApp: { capable: true, title: "SCC", statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" },
};

// Mobile-first: fit the device width, tint the browser chrome club green, extend
// under the notch/home-indicator so the safe-area insets resolve, and keep
// pinch-zoom enabled for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#335d3b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
