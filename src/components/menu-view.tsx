"use client";

import Image from "next/image";
import { useState } from "react";
import { Lightbox, type LightboxImage } from "@/components/lightbox";
import { cn } from "@/lib/cn";

/**
 * Member-facing menu viewer: a Lunch/Dinner toggle over the actual menu pages,
 * rendered as images (from the club's menu PDF). Tapping a page opens the shared
 * Lightbox for full-screen, swipeable zoom. The pages live in /public/menu and
 * are served through next/image, which re-encodes them to AVIF/WebP per request.
 */

type MenuKey = "lunch" | "dinner";

// Intrinsic pixel size of every rendered page (US-letter at ~216dpi). Passing
// the true aspect ratio lets next/image reserve space and avoid layout shift.
const PAGE_W = 1836;
const PAGE_H = 2375;

const MENUS: Record<
  MenuKey,
  { label: string; pages: { src: string; alt: string }[] }
> = {
  lunch: {
    label: "Lunch",
    pages: [
      { src: "/menu/lunch-1.jpg", alt: "Lunch menu — appetizers, bowls and salads" },
      { src: "/menu/lunch-2.jpg", alt: "Lunch menu — handhelds, kids and sides" },
    ],
  },
  dinner: {
    label: "Dinner",
    pages: [
      { src: "/menu/dinner-1.jpg", alt: "Dinner menu — appetizers and salads" },
      { src: "/menu/dinner-2.jpg", alt: "Dinner menu — entrées, sides and desserts" },
    ],
  },
};

const ORDER: MenuKey[] = ["lunch", "dinner"];

export function MenuView() {
  const [active, setActive] = useState<MenuKey>("lunch");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { pages } = MENUS[active];
  const lightboxImages: LightboxImage[] = pages.map((p) => ({
    url: p.src,
    alt: p.alt,
  }));

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Menu"
        className="inline-flex rounded-lg border border-border bg-surface-2 p-1"
      >
        {ORDER.map((key) => {
          const selected = key === active;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(key)}
              className={cn(
                "min-w-[6.5rem] rounded-md px-4 py-2 text-sm font-medium transition-colors",
                selected
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {MENUS[key].label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {pages.map((page, i) => (
          <button
            key={page.src}
            type="button"
            onClick={() => setLightboxIndex(i)}
            aria-label={`${MENUS[active].label} menu, page ${i + 1} — tap to enlarge`}
            className="card block w-full cursor-zoom-in overflow-hidden p-0 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Image
              src={page.src}
              alt={page.alt}
              width={PAGE_W}
              height={PAGE_H}
              sizes="(max-width: 768px) 100vw, 680px"
              className="h-auto w-full"
              priority={active === "lunch" && i === 0}
            />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
