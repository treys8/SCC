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
};

// Mobile-first: fit the device width, tint the browser chrome club green, and
// keep pinch-zoom enabled for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
